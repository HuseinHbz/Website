import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
    // 'unsafe-eval' lets any injected script call eval()/Function() — one of
    // the two things that make script-src 'unsafe-inline' + 'unsafe-eval'
    // together close to no restriction at all against XSS. Next's dev-mode
    // HMR/eval-source-map genuinely needs it; a production build does not
    // (verified: full app walk — public site, admin CMS incl. recharts/
    // framer-motion/RichTextEditor — with zero CSP violations after removing
    // it). 'unsafe-inline' stays for now — removing it needs Next's nonce
    // mechanism wired through every inline script (hydration payload,
    // styled-jsx, admin RichTextEditor previews) and is a distinct, riskier
    // change flagged for its own pass rather than attempted blind here.
    const scriptSrc = process.env.NODE_ENV === 'production'
      ? `script-src 'self' 'unsafe-inline'`
      : `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
              `font-src 'self' https://fonts.gstatic.com`,
              `img-src 'self' data: blob: https:`,
              `connect-src 'self' ${apiUrl}`,
              `frame-ancestors 'none'`,
              `base-uri 'self'`,
              `form-action 'self'`,
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
}

// Admin routes bypass next-intl — only apply intl plugin for non-admin routes
export default withNextIntl({
  ...nextConfig,
  // Allow server-only modules in API routes
  serverExternalPackages: ['better-sqlite3', 'bcryptjs', 'nodemailer'],
})
