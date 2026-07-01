import createMDX from '@next/mdx'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const withMDX = createMDX({})

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
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
export default withNextIntl(withMDX({
  ...nextConfig,
  // Allow server-only modules in API routes
  serverExternalPackages: ['better-sqlite3', 'bcryptjs', 'nodemailer'],
}))
