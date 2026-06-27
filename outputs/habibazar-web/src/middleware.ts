import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import createIntlMiddleware from 'next-intl/middleware'

const locales = ['fa', 'en']
const defaultLocale = 'fa'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
})

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'HBZ-Admin-Secret-Key-2025-Change-In-Production'
)

async function verifyToken(token: string) {
  await jwtVerify(token, JWT_SECRET)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin API routes (/api/admin/*) ──────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      await verifyToken(token)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Admin UI pages (/admin/*) ─────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    try {
      await verifyToken(token)
      return NextResponse.next()
    } catch {
      const response = NextResponse.redirect(new URL('/admin/login', request.url))
      response.cookies.delete('admin_token')
      return response
    }
  }

  // ── Public routes: next-intl i18n ─────────────────────────────────────────
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
}
