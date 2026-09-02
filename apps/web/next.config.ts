import type { NextConfig } from "next";
import { join } from "node:path";

const root = join(__dirname, "../..");

// Cloudflare Workers via OpenNext — `output: "standalone"` removed (Docker only).
// See apps/web/wrangler.jsonc + open-next.config.ts for the Workers binding.

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    // Next.js hydrates via inline scripts => unsafe-inline required.
    // connect-src allows the Pages app origin (placeholder until project names final).
    // React's dev runtime uses eval() for debugging aids, so 'unsafe-eval'
    // is allowed only in development; production never evaluates strings.
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://kataria-app.pages.dev",
      // Contact page embeds a Google Maps iframe (maps.google.com).
      "frame-src https://maps.google.com https://www.google.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  outputFileTracingRoot: root,
  turbopack: { root },
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
