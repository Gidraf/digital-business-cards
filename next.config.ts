import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // Mounted under a sub-path so Reactive Resume can own the domain root.
    // Keep in sync with BASE_PATH in lib/base-path.ts.
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/cards",
};

export default nextConfig;
