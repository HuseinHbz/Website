import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import createIntlMiddleware from 'next-intl/middleware'
import { limiters } from '@/lib/rateLimit'

const locales = ['fa', 'en']
const defaultLocale = 'fa'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
})

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'HBZ-Admin-Secret-Key-2025-Change-In-Production'
)

async function verifyToken(token: string): Promise<{ role?: string }> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return { role: typeof payload.role === 'string' ? payload.role : undefined }
}

// Read-only roles (26.22): every mutation is refused centrally, before any
// route runs — route-level canDo gates remain the second line of defence.
const READ_ONLY_ROLES = new Set(['auditor', 'viewer'])
const READ_ONLY_ALLOWED_POSTS = new Set(['/api/admin/auth/logout'])

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // ── Health check — always allow ───────────────────────────────────────────
  if (pathname === '/api/health') return NextResponse.next()

  // ── Admin API routes (/api/admin/*) ──────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    if (pathname === '/api/admin/auth/login') {
      const limit = limiters.login(ip)
      if (!limit.allowed) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
        )
      }
      return NextResponse.next()
    }
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const { role } = await verifyToken(token)
      if (role && READ_ONLY_ROLES.has(role) && request.method !== 'GET' && !READ_ONLY_ALLOWED_POSTS.has(pathname)) {
        return NextResponse.json({ error: 'This role is read-only' }, { status: 403 })
      }
      return NextResponse.next()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── AI API — stricter rate limiting ──────────────────────────────────────
  if (pathname.startsWith('/api/ai')) {
    const limit = limiters.ai(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'AI rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }
  }

  // ── Contact / consultation form ───────────────────────────────────────────
  if (pathname === '/api/consultation' || pathname === '/api/contact') {
    const limit = limiters.contact(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }
  }

  // ── General API rate limiting ─────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const limit = limiters.api(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }
    return NextResponse.next()
  }

  // ── Admin UI pages (/admin/*) ─────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next()
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
    '/api/:path*',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
}
