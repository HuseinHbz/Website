'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, PageHeader, useToast } from '@/components/admin/ui'

type TwoFAState = {
  enabled: boolean
  secret: string
  qrCode: string
}

export function SecurityManager() {
  const [state, setState] = useState<TwoFAState | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<'view' | 'setup' | 'disable'>('view')
  const { toast, ToastContainer } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/auth/2fa')
    const d = await r.json()
    setState(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function startSetup() {
    // Regenerate secret / QR
    const r = await fetch('/api/admin/auth/2fa')
    const d = await r.json()
    setState(d)
    setCode('')
    setPhase('setup')
  }

  async function enable() {
    if (code.length < 6) return
    setSaving(true)
    const r = await fetch('/api/admin/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable', code }),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      toast('Two-factor authentication enabled!', 'success')
      setPhase('view')
      setCode('')
      load()
    } else {
      toast(d.error || 'Invalid code — try again', 'error')
      setCode('')
    }
  }

  async function disable() {
    if (code.length < 6) return
    setSaving(true)
    const r = await fetch('/api/admin/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable', code }),
    })
    const d = await r.json()
    setSaving(false)
    if (r.ok) {
      toast('Two-factor authentication disabled', 'success')
      setPhase('view')
      setCode('')
      load()
    } else {
      toast(d.error || 'Invalid code — try again', 'error')
      setCode('')
    }
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Security" subtitle="Manage two-factor authentication for your account" />

      {loading ? (
        <Card className="p-8 text-center text-slate-500">Loading...</Card>
      ) : (
        <div className="max-w-lg space-y-6">

          {/* Status card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Two-Factor Authentication (TOTP)</p>
                <p className="text-xs text-slate-500 mt-0.5">Requires Google Authenticator or compatible app</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${state?.enabled ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                {state?.enabled ? '● Enabled' : '○ Disabled'}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              {!state?.enabled ? (
                <Btn onClick={startSetup}>Set up 2FA</Btn>
              ) : (
                <Btn variant="danger" onClick={() => { setCode(''); setPhase('disable') }}>Disable 2FA</Btn>
              )}
            </div>
          </Card>

          {/* Setup flow */}
          {phase === 'setup' && state && (
            <Card className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-white">Setup Two-Factor Authentication</h3>

              <div className="space-y-1">
                <p className="text-xs text-slate-400">Step 1 — Scan this QR code in Google Authenticator or Authy:</p>
                <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-400">Or enter this secret manually:</p>
                <code className="block bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-2 text-xs text-indigo-300 tracking-widest break-all select-all">
                  {state.secret}
                </code>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Step 2 — Enter the 6-digit code from your app to confirm:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-3 text-2xl text-white text-center tracking-[0.4em] font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <Btn onClick={enable} disabled={saving || code.length < 6}>
                  {saving ? 'Verifying...' : 'Activate 2FA'}
                </Btn>
                <Btn variant="secondary" onClick={() => { setPhase('view'); setCode('') }}>Cancel</Btn>
              </div>
            </Card>
          )}

          {/* Disable flow */}
          {phase === 'disable' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Disable Two-Factor Authentication</h3>
              <p className="text-xs text-slate-400">Enter the current code from your authenticator app to confirm:</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full bg-[#0c0c14] border border-[#2a2a3e] rounded-lg px-3 py-3 text-2xl text-white text-center tracking-[0.4em] font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <div className="flex gap-3">
                <Btn variant="danger" onClick={disable} disabled={saving || code.length < 6}>
                  {saving ? 'Verifying...' : 'Confirm Disable'}
                </Btn>
                <Btn variant="secondary" onClick={() => { setPhase('view'); setCode('') }}>Cancel</Btn>
              </div>
            </Card>
          )}

          {/* How to use */}
          {phase === 'view' && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-400 mb-2">How it works</p>
              <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
                <li>After enabling, login will require a 6-digit code</li>
                <li>Install Google Authenticator, Authy, or any TOTP app</li>
                <li>Scan the QR code during setup to link your account</li>
                <li>Each code is valid for 30 seconds</li>
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
