import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/basePath";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // Self-contained server bundle (.next/standalone) for offline deployment: no npm install on the target.
  output: "standalone",
  // Serve /public images as-is: avoids the native `sharp` dependency so a bundle built on Windows runs on Linux.
  images: { unoptimized: true },
  // ...and keep sharp's OS-specific binaries out of the standalone bundle (never loaded with unoptimized images).
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  // Whole app is served under /kfidp (sign-in: /kfidp/{TenantId})
  basePath: BASE_PATH,
  async redirects() {
    return [
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      // Server-side 307 (not the prerendered client redirect of app/page.tsx), so post-login lands on the dashboard
      { source: "/", destination: "/dashboard", permanent: false },
    ];
  },
  // All images are served from /public; no remote hosts are allowed through the optimizer.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
  // ESLint during build: configure via eslint.config.mjs and run `npm run lint` separately (Next.js 16+).
  // Add empty turbopack config to silence warnings
  turbopack: {},
  // Keep webpack config for ag-grid externals (needed for SSR)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude ag-grid from server-side rendering
      config.externals = config.externals || [];
      config.externals.push({
        'ag-grid-react': 'ag-grid-react',
        'ag-grid-community': 'ag-grid-community',
        'ag-grid-enterprise': 'ag-grid-enterprise',
      });
    }
    return config;
  },
};

export default nextConfig;
