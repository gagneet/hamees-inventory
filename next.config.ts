import type { NextConfig } from "next";

// Baseline security headers for every response (the app is served publicly via Cloudflare → nginx)
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

// Restrictive-by-default directives that don't need script nonces. Script/style sources are left
// open because Next.js injects inline bootstrap scripts; a nonce-based policy is a follow-up.
const contentSecurityPolicy = [
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // Allows building a verification copy (e.g. NEXT_DIST_DIR=.next-verify) without
  // touching the .next directory served by the running production process.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-alert-dialog',
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Design-upload files set their own stricter sandbox CSP in the route handler
      {
        source: '/:path((?!api/design-uploads/).*)',
        headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }],
      },
      // Authenticated API responses must never be cached by browsers or the CDN
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
