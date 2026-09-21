import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Progress used to be its own page; it is now the lower half of /review,
      // so anything bookmarked or linked to /dashboard lands where it moved to.
      { source: "/dashboard", destination: "/review", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Engine binaries and stdlib packs have content hashes in their names,
        // so the ~22 MB (gzipped) first download is paid once.
        source: "/engine/gen/:file((?:compile|link|std-[a-z]+)\\.[0-9a-f]{10}\\.(?:wasm|pack)(?:\\.gz)?)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Monaco: 152 files, ~24 MB, served with the editor version in the path
        // (scripts/copy-monaco.mjs). Without this they came back
        // `max-age=0, must-revalidate`, so every visit that opened an editor paid a
        // revalidation round trip per chunk. An upgrade changes the path, so this
        // can never serve a stale file.
        source: "/monaco/:version([0-9]+\\.[0-9]+\\.[0-9]+)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
