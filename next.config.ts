import os from "node:os";
import type { NextConfig } from "next";

/**
 * Next 16 blocks dev-only requests (including the live-update socket) from any
 * origin but localhost. Without that socket React never starts, so every button
 * is dead on http://127.0.0.1:3000 or http://<this machine's IP>:3000. Allow
 * 127.0.0.1, this machine's network addresses, and DEV_ALLOWED_ORIGINS
 * (comma-separated). Development only; production ignores this setting.
 */
function devOrigins(): string[] {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
  const extra = (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(["127.0.0.1", ...addresses, ...extra])];
}

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
  allowedDevOrigins: process.env.NODE_ENV === "production" ? [] : devOrigins(),
  // Shows that a page is compiling, so a first click in development doesn't look
  // dead. Bottom-left keeps it clear of the chat widget launcher on the right.
  devIndicators: { position: "bottom-left" },
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
