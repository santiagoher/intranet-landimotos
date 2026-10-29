import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [{
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
  experimental: {
    // Synced folders can introduce conflict copies into Turbopack's numeric
    // cache files. Keep development compilation in memory instead.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
