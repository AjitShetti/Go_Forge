import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Engine binaries and stdlib packs have content hashes in their names,
        // so the ~22 MB (gzipped) first download is paid once.
        source: "/engine/gen/:file((?:compile|link|std-[a-z]+)\\.[0-9a-f]{10}\\.(?:wasm|pack)(?:\\.gz)?)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
