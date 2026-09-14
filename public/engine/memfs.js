// In-memory filesystem implementing the Node-style callback API that Go's
// syscall/fs_js.go calls through globalThis.fs. The Go toolchain (compile,
// link) reads the stdlib archives from it and writes its outputs to it; user
// programs get their own fresh instance so they cannot touch the toolchain's.
//
// Classic script (no modules): loaded via importScripts in the Web Worker and
// via vm.runInThisContext in Node scripts.

(function (g) {
  "use strict";

  const S_IFREG = 0o100000;
  const S_IFDIR = 0o040000;
  // Linux values, matching what Node reports; Go only needs them to be distinct.
  const constants = { O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128, O_TRUNC: 512, O_APPEND: 1024, O_DIRECTORY: 65536 };

  function fsError(code, path) {
    const e = new Error(`${code}: ${path ?? ""}`);
    e.code = code;
    return e;
  }

  /**
   * @param {{onWrite?: (fd: number, bytes: Uint8Array) => void}} [opts]
   *   onWrite receives every write to fd 1 (stdout) and fd 2 (stderr).
   */
  function createMemFS(opts = {}) {
    let nextIno = 1;
    const nodes = new Map(); // absolute path -> node
    const fds = new Map(); // fd -> { path, node, pos, append }
    let nextFd = 10;
    let cwd = "/";

    const now = () => Date.now();
    const mkdirNode = () => ({ dir: true, ino: nextIno++, mode: 0o755, mtime: now() });
    const mkfileNode = (data) => ({ dir: false, ino: nextIno++, mode: 0o644, mtime: now(), data: data ?? new Uint8Array(0), size: data ? data.length : 0 });
    nodes.set("/", mkdirNode());

    function norm(p) {
      p = String(p);
      if (!p.startsWith("/")) p = (cwd === "/" ? "" : cwd) + "/" + p;
      const parts = [];
      for (const seg of p.split("/")) {
        if (seg === "" || seg === ".") continue;
        if (seg === "..") parts.pop();
        else parts.push(seg);
      }
      return "/" + parts.join("/");
    }
    const parentOf = (p) => {
      const i = p.lastIndexOf("/");
      return i <= 0 ? "/" : p.slice(0, i);
    };

    function statOf(node) {
      const size = node.dir ? 4096 : node.size;
      return {
        dev: 1, ino: node.ino, mode: (node.dir ? S_IFDIR : S_IFREG) | node.mode, nlink: 1, uid: 0, gid: 0, rdev: 0,
        size, blksize: 4096, blocks: Math.ceil(size / 512), atimeMs: node.mtime, mtimeMs: node.mtime, ctimeMs: node.mtime,
        isDirectory: () => node.dir,
      };
    }

    function ensureCapacity(node, size) {
      if (size <= node.data.length) return;
      const next = new Uint8Array(Math.max(size, node.data.length * 2, 4096));
      next.set(node.data.subarray(0, node.size));
      node.data = next;
    }

    // Wraps a sync implementation into Node's (…, callback) convention.
    const cb = (impl) => (...args) => {
      const callback = args.pop();
      let result, error = null;
      try {
        result = impl(...args);
      } catch (e) {
        error = e;
      }
      callback(error, result);
    };

    const api = {
      constants,

      // --- helpers used by the engine itself (not part of Node's API) ---
      mkdirp(p) {
        p = norm(p);
        const parts = p.split("/").filter(Boolean);
        let cur = "";
        for (const part of parts) {
          cur += "/" + part;
          if (!nodes.has(cur)) nodes.set(cur, mkdirNode());
        }
      },
      /** Stores bytes without copying; the caller must not mutate them later. */
      writeFile(p, data) {
        p = norm(p);
        api.mkdirp(parentOf(p));
        nodes.set(p, mkfileNode(typeof data === "string" ? new TextEncoder().encode(data) : data));
      },
      readFile(p) {
        const node = nodes.get(norm(p));
        if (!node || node.dir) throw fsError("ENOENT", p);
        return node.data.subarray(0, node.size);
      },
      exists: (p) => nodes.has(norm(p)),
      removeTree(p) {
        p = norm(p);
        for (const key of [...nodes.keys()]) if (key === p || key.startsWith(p + "/")) nodes.delete(key);
      },

      // --- Node fs callback API used by syscall/fs_js.go ---
      writeSync(fd, buf) {
        if (fd === 1 || fd === 2) {
          if (opts.onWrite) opts.onWrite(fd, buf.slice());
          return buf.length;
        }
        throw fsError("EBADF");
      },
      write(fd, buf, offset, length, position, callback) {
        if (fd === 1 || fd === 2) {
          if (opts.onWrite) opts.onWrite(fd, buf.slice(offset, offset + length));
          callback(null, length);
          return;
        }
        const f = fds.get(fd);
        if (!f) return callback(fsError("EBADF"));
        const node = f.node;
        let pos = position ?? (f.append ? node.size : f.pos);
        ensureCapacity(node, pos + length);
        node.data.set(buf.subarray(offset, offset + length), pos);
        node.size = Math.max(node.size, pos + length);
        node.mtime = now();
        if (position === null || position === undefined) f.pos = pos + length;
        callback(null, length);
      },
      read(fd, buf, offset, length, position, callback) {
        const f = fds.get(fd);
        if (!f) return callback(fsError("EBADF"));
        if (f.node.dir) return callback(fsError("EISDIR"));
        const pos = position ?? f.pos;
        const n = Math.max(0, Math.min(length, f.node.size - pos));
        buf.set(f.node.data.subarray(pos, pos + n), offset);
        if (position === null || position === undefined) f.pos = pos + n;
        callback(null, n);
      },
      open: cb((path, flags, mode) => {
        const p = norm(path);
        let node = nodes.get(p);
        if (node && (flags & constants.O_CREAT) && (flags & constants.O_EXCL)) throw fsError("EEXIST", p);
        if (!node) {
          if (!(flags & constants.O_CREAT)) throw fsError("ENOENT", p);
          const parent = nodes.get(parentOf(p));
          if (!parent || !parent.dir) throw fsError("ENOENT", p);
          node = mkfileNode();
          nodes.set(p, node);
        }
        if ((flags & constants.O_DIRECTORY) && !node.dir) throw fsError("ENOTDIR", p);
        if (!node.dir && (flags & constants.O_TRUNC)) node.size = 0;
        const fd = nextFd++;
        fds.set(fd, { path: p, node, pos: 0, append: !!(flags & constants.O_APPEND) });
        return fd;
      }),
      close: cb((fd) => {
        if (!fds.delete(fd)) throw fsError("EBADF");
      }),
      fstat: cb((fd) => {
        const f = fds.get(fd);
        if (!f) throw fsError("EBADF");
        return statOf(f.node);
      }),
      stat: cb((path) => {
        const node = nodes.get(norm(path));
        if (!node) throw fsError("ENOENT", path);
        return statOf(node);
      }),
      lstat(path, callback) {
        api.stat(path, callback);
      },
      readdir: cb((path) => {
        const p = norm(path);
        const node = nodes.get(p);
        if (!node) throw fsError("ENOENT", p);
        if (!node.dir) throw fsError("ENOTDIR", p);
        const prefix = p === "/" ? "/" : p + "/";
        const names = [];
        for (const key of nodes.keys()) {
          if (key !== p && key.startsWith(prefix) && !key.slice(prefix.length).includes("/")) names.push(key.slice(prefix.length));
        }
        return names;
      }),
      mkdir: cb((path, perm) => {
        const p = norm(path);
        if (nodes.has(p)) throw fsError("EEXIST", p);
        const parent = nodes.get(parentOf(p));
        if (!parent || !parent.dir) throw fsError("ENOENT", p);
        nodes.set(p, mkdirNode());
      }),
      rmdir: cb((path) => {
        const p = norm(path);
        const node = nodes.get(p);
        if (!node) throw fsError("ENOENT", p);
        if (!node.dir) throw fsError("ENOTDIR", p);
        for (const key of nodes.keys()) if (key.startsWith(p + "/")) throw fsError("ENOTEMPTY", p);
        nodes.delete(p);
      }),
      unlink: cb((path) => {
        const p = norm(path);
        const node = nodes.get(p);
        if (!node) throw fsError("ENOENT", p);
        if (node.dir) throw fsError("EISDIR", p);
        nodes.delete(p);
      }),
      rename: cb((from, to) => {
        const a = norm(from), b = norm(to);
        const node = nodes.get(a);
        if (!node) throw fsError("ENOENT", a);
        for (const key of [...nodes.keys()]) {
          if (key === a || key.startsWith(a + "/")) {
            const n = nodes.get(key);
            nodes.delete(key);
            nodes.set(b + key.slice(a.length), n);
          }
        }
      }),
      ftruncate: cb((fd, length) => {
        const f = fds.get(fd);
        if (!f) throw fsError("EBADF");
        ensureCapacity(f.node, length);
        if (length > f.node.size) f.node.data.fill(0, f.node.size, length);
        f.node.size = length;
      }),
      truncate: cb((path, length) => {
        const node = nodes.get(norm(path));
        if (!node) throw fsError("ENOENT", path);
        ensureCapacity(node, length);
        node.size = length;
      }),
      fsync: cb(() => {}),
      chmod: cb(() => {}),
      fchmod: cb(() => {}),
      chown: cb(() => {}),
      fchown: cb(() => {}),
      lchown: cb(() => {}),
      utimes: cb((path, atime, mtime) => {
        const node = nodes.get(norm(path));
        if (!node) throw fsError("ENOENT", path);
        node.mtime = mtime * 1000;
      }),
      readlink: cb((path) => {
        throw fsError("EINVAL", path);
      }),
      symlink: cb(() => {
        throw fsError("ENOSYS");
      }),
      link: cb(() => {
        throw fsError("ENOSYS");
      }),

      // process.cwd / process.chdir backing
      cwd: () => cwd,
      chdir(p) {
        const n = norm(p);
        const node = nodes.get(n);
        if (!node || !node.dir) throw fsError("ENOENT", p);
        cwd = n;
      },
    };
    return api;
  }

  /** Makes `memfs` the filesystem (and cwd) that the next Go instance will see.
   *  Go's syscall package reads globalThis.fs once, when the instance starts. */
  function installFS(memfs) {
    g.fs = memfs;
    const isNode = typeof g.process === "object" && g.process && g.process.versions && g.process.versions.node;
    if (isNode) {
      // Only ever done inside a dedicated worker_threads Worker.
      g.process.cwd = memfs.cwd;
      g.process.chdir = memfs.chdir;
    } else {
      g.process = {
        getuid: () => -1, getgid: () => -1, geteuid: () => -1, getegid: () => -1,
        getgroups() { throw fsError("ENOSYS"); },
        pid: -1, ppid: -1,
        umask: () => 0o022,
        cwd: memfs.cwd,
        chdir: memfs.chdir,
      };
    }
  }

  g.GoForgeMemFS = { createMemFS, installFS };
})(globalThis);
