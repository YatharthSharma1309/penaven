import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const productionHeaders = [
  ...baseSecurityHeaders,
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const securityHeaders =
  process.env.NODE_ENV === "production" ? productionHeaders : baseSecurityHeaders;

const nextConfig: NextConfig = {
  // The two-client e2e suite builds into its own folder, so it never touches
  // the `.next` of a dev server already running in the same checkout.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  // The corner mark is the dev-tools button. Hide it so it does not cover the page.
  // Compile and runtime errors still open on their own.
  devIndicators: false,
  experimental: {
    // Above the largest upload (10 MB plus multipart overhead). Past this limit
    // the proxy cuts the body short, and routes could not return their own 413.
    proxyClientMaxBodySize: "11mb",
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/widget/embed",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
