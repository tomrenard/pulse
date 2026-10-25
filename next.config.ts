import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Races was renamed Records: old bookmarks and restored PWA pages still land.
  async redirects() {
    return [{ source: "/races", destination: "/records", permanent: true }];
  },
  async headers() {
    return [
      {
        // The service worker must be re-checked on every load, or updates never arrive.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default config;
