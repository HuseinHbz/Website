'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (requiresTwoFactor && tempToken) {
        // Submit 2FA code
        const res = await fetch(`${API_URL}/api/v1/auth/2fa/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: totpCode, tempToken }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error?.message || 'Invalid 2FA code')
        }

        router.push('/dashboard')
        router.refresh()
      } else {
        // Login
        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error?.message || 'Login failed')
        }

        if (data?.data?.requiresTwoFactor) {
          setRequiresTwoFactor(true)
          setTempToken(data?.data?.tempToken || null)
        } else {
          router.push('/dashboard')
          router.refresh()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Habibazar Admin</h1>
          <p className="text-text-muted mt-1 text-sm">
            {requiresTwoFactor ? 'Two-factor authentication' : 'Sign in to your admin account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!requiresTwoFactor ? (
              <>
                <div>
                  <label htmlFor="email" className="form-label">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@habibazar.ir"
                    className="form-input"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-input"
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="totp" className="form-label">
                  Authenticator code
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="form-input text-center text-xl tracking-widest"
                />
                <p className="mt-2 text-xs text-text-muted">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {requiresTwoFactor ? 'Verifying...' : 'Signing in...'}
                </span>
              ) : requiresTwoFactor ? 'Verify' : 'Sign in'}
            </button>

            {requiresTwoFactor && (
              <button
                type="button"
                onClick={() => {
                  setRequiresTwoFactor(false)
                  setTempToken(null)
                  setTotpCode('')
                  setError(null)
                }}
                className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Back to login
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          Habibazar Admin &mdash; Internal use only
        </p>
      </div>
    </div>
  )
}
