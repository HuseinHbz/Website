import { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /admin and /api were already covered. The rest are authenticated
        // or token-gated app surfaces (customer/HR/vendor portals, the
        // payment callback flow) — never in PUBLIC_ROUTES/the sitemap, no
        // SEO value, and a login/OTP screen or a token-bearing vendor link
        // has no business being crawlable even if something happens to
        // link to it. `/verify/[code]` stays allowed — it's a deliberately
        // public document-authenticity check, not an app surface.
        disallow: ['/admin', '/api', '/portal', '/*/portal', '/hr-portal', '/*/hr-portal', '/vendor', '/*/vendor', '/pay', '/*/pay'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  }
}
