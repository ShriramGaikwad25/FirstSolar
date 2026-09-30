import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  async redirects() {
    return [
      {
        source: "/non-human-identity-1/lookups",
        destination: "/settings/gateway/nhi-settings",
        permanent: false,
      },
      {
        source: "/non-human-identity-1/emergency",
        destination: "/non-human-identity/request-access",
        permanent: false,
      },
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
  typescript: {
    ignoreBuildErrors: true,
  },
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
