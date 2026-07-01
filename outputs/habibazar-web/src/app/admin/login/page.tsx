'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body = step === 'totp'
        ? { email, password, totpCode }
        : { email, password }

      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.requireTotp) {
        setStep('totp')
        setTotpCode('')
        return
      }

      if (!res.ok) {
        setError(data.error || 'Login failed')
        if (step === 'totp') setTotpCode('')
      } else {
        router.push('/admin')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 items-center justify-center text-white text-xl font-black mb-4 shadow-lg shadow-indigo-500/20">
            HBZ
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {step === 'totp' ? 'Two-Factor Authentication' : 'Sign in to manage your website'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          {step === 'credentials' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-2xl">
                  🔐
                </div>
              </div>
              <p className="text-xs text-text-secondary text-center mb-4">
                Enter the 6-digit code from your authenticator app
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full bg-background border border-border rounded-lg px-3 py-3 text-2xl text-white text-center tracking-[0.5em] font-mono focus:outline-none focus:border-brand transition-colors"
              />
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setTotpCode('') }}
                className="mt-3 w-full text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                ← Back to login
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (step === 'totp' && totpCode.length < 6)}
            className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Verifying...' : step === 'totp' ? 'Verify Code' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
