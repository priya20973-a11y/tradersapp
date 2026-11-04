import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Security headers applied to every response.
 * Tightened for a single-origin ERP app (no external CDN, no embeds, no cross-origin iframes).
 */
const securityHeaders = [
  // Prevent clickjacking — this app is never embedded in an iframe
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Prevent MIME-type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Only send Referer header to same-origin requests
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Disable client-side feature access not needed for an ERP
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Force HTTPS for 1 year (only meaningful in production)
  ...(!isDevelopment
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
  // Cross-Origin Opener Policy
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  // Cross-Origin Resource Policy
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  // ── Redirections ──────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: "/sales", destination: "/sales/customers", permanent: false },
      { source: "/customers", destination: "/sales/customers", permanent: false },
      { source: "/invoices", destination: "/sales/invoices", permanent: false },
    ];
  },

  // ── Security headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // ── TypeScript ───────────────────────────────────────────────────────────
  typescript: {
    // Type errors will fail the build. Do not set ignoreBuildErrors: true.
    ignoreBuildErrors: false,
  },

  // ── Turbopack (dev server) ────────────────────────────────────────────────
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // ── Production build: minify, remove console.log ─────────────────────────
  ...(!isDevelopment && {
    compiler: {
      removeConsole: {
        exclude: ["error", "warn"],
      },
    },
  }),
};

export default nextConfig;
