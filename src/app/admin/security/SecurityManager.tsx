'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type TwoFAState = {
  enabled: boolean
  secret: string
  qrCode: string
}

export function SecurityManager() {
  const t = useT()
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
      toast(t('twoFaEnabled'), 'success')
      setPhase('view')
      setCode('')
      load()
    } else {
      toast(d.error || t('twoFaInvalidCode'), 'error')
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
      toast(t('twoFaDisabled2'), 'success')
      setPhase('view')
      setCode('')
      load()
    } else {
      toast(d.error || t('twoFaInvalidCode'), 'error')
      setCode('')
    }
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title={t('securityTitle')} subtitle={t('securitySub')} />

      {loading ? (
        <Card className="p-8 text-center text-text-tertiary">{t('loading')}</Card>
      ) : (
        <div className="max-w-lg space-y-6">

          {/* Status card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Two-Factor Authentication (TOTP)</p>
                <p className="text-xs text-text-tertiary mt-0.5">Requires Google Authenticator or compatible app</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${state?.enabled ? 'bg-green-500/15 text-green-400' : 'bg-surface-2 text-text-secondary'}`}>
                {state?.enabled ? `● ${t('twoFaEnabled')}` : `○ ${t('twoFaDisabled')}`}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              {!state?.enabled ? (
                <Btn onClick={startSetup}>{t('setup2fa')}</Btn>
              ) : (
                <Btn variant="danger" onClick={() => { setCode(''); setPhase('disable') }}>{t('disable2fa')}</Btn>
              )}
            </div>
          </Card>

          {/* Setup flow */}
          {phase === 'setup' && state && (
            <Card className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-text-primary">Setup Two-Factor Authentication</h3>

              <div className="space-y-1">
                <p className="text-xs text-text-secondary">Step 1 — Scan this QR code in Google Authenticator or Authy:</p>
                <div className="flex justify-center p-4 bg-surface rounded-xl w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-text-secondary">Or enter this secret manually:</p>
                <code className="block bg-background border border-border rounded-lg px-3 py-2 text-xs text-brand tracking-widest break-all select-all">
                  {state.secret}
                </code>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-text-secondary">Step 2 — Enter the 6-digit code from your app to confirm:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 text-2xl text-text-primary text-center tracking-[0.4em] font-mono focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <Btn onClick={enable} disabled={saving || code.length < 6}>
                  {saving ? t('verifying') : t('activate2fa')}
                </Btn>
                <Btn variant="secondary" onClick={() => { setPhase('view'); setCode('') }}>{t('cancel')}</Btn>
              </div>
            </Card>
          )}

          {/* Disable flow */}
          {phase === 'disable' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Disable Two-Factor Authentication</h3>
              <p className="text-xs text-text-secondary">Enter the current code from your authenticator app to confirm:</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full bg-background border border-border rounded-lg px-3 py-3 text-2xl text-text-primary text-center tracking-[0.4em] font-mono focus:outline-none focus:border-brand transition-colors"
              />
              <div className="flex gap-3">
                <Btn variant="danger" onClick={disable} disabled={saving || code.length < 6}>
                  {saving ? t('verifying') : t('confirmDisable')}
                </Btn>
                <Btn variant="secondary" onClick={() => { setPhase('view'); setCode('') }}>{t('cancel')}</Btn>
              </div>
            </Card>
          )}

          {/* How to use */}
          {phase === 'view' && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-text-secondary mb-2">How it works</p>
              <ul className="text-xs text-text-tertiary space-y-1.5 list-disc list-inside">
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
