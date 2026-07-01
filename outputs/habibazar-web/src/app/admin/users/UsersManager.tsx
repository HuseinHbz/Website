'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type User = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; lastLogin: string; totpEnabled?: boolean }
const EMPTY = { name: '', email: '', password: '', role: 'editor' }
const ROLE_COLOR: Record<string, string> = { super_admin: 'yellow', administrator: 'blue', editor: 'green' }

type TwoFAPanel = { userId: string; email: string; secret: string; qrCode: string; enabled: boolean; phase: 'view' | 'setup' | 'confirm' }

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string }>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [twoFA, setTwoFA] = useState<TwoFAPanel | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpSaving, setTotpSaving] = useState(false)
  const t = useT()
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/users')
    const d = await r.json()
    setUsers(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/users', { method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false)
    if (res.ok) { toast('Saved'); setModal(false); load() } else { const d = await res.json(); toast(d.error || 'Failed', 'error') }
  }

  async function toggleActive(user: User) {
    await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, active: !user.active }) })
    toast(`User ${user.active ? 'deactivated' : 'activated'}`); load()
  }

  async function del(id: string) {
    if (!confirm('Delete this user?')) return
    const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const data = await res.json()
    if (!res.ok) { toast(data.error || 'Delete failed', 'error'); return }
    toast('Deleted', 'success'); load()
  }

  async function open2FA(user: User) {
    const r = await fetch(`/api/admin/auth/2fa?userId=${user.id}`)
    const d = await r.json()
    if (!r.ok) { toast(d.error || 'Failed', 'error'); return }
    setTotpCode('')
    setTwoFA({ userId: user.id, email: d.email, secret: d.secret, qrCode: d.qrCode, enabled: d.enabled, phase: 'view' })
  }

  async function startSetup() {
    if (!twoFA) return
    const r = await fetch(`/api/admin/auth/2fa?userId=${twoFA.userId}`)
    const d = await r.json()
    setTwoFA({ ...twoFA, secret: d.secret, qrCode: d.qrCode, phase: 'setup' })
    setTotpCode('')
  }

  async function confirmEnable() {
    if (!twoFA || totpCode.length < 6) return
    setTotpSaving(true)
    const r = await fetch('/api/admin/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable', code: totpCode, userId: twoFA.userId }),
    })
    const d = await r.json()
    setTotpSaving(false)
    if (r.ok) {
      toast('2FA enabled', 'success')
      setTwoFA(null)
      load()
    } else {
      toast(d.error || 'Invalid code', 'error')
      setTotpCode('')
    }
  }

  async function disable2FA() {
    if (!twoFA) return
    setTotpSaving(true)
    const r = await fetch('/api/admin/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable', code: '000000', userId: twoFA.userId }),
    })
    setTotpSaving(false)
    if (r.ok) { toast('2FA disabled', 'success'); setTwoFA(null); load() }
    else toast('Failed', 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Users & Role Management" subtitle="Manage admin panel access and permissions" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ Invite User</Btn>} />

      <Card>
        <Table headers={['User', 'Role', '2FA', 'Status', 'Last Login', 'Actions']}>
          {users.map((u) => (
            <TR key={u.id}>
              <TD>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{u.name}{u.id === currentUserId && <span className="text-xs text-text-tertiary ml-2">(you)</span>}</div>
                    <div className="text-xs text-text-tertiary">{u.email}</div>
                  </div>
                </div>
              </TD>
              <TD><Badge color={ROLE_COLOR[u.role] || 'slate'}>{u.role.replace('_', ' ')}</Badge></TD>
              <TD>
                <button onClick={() => open2FA(u)} className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${u.totpEnabled ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-surface-2/50 text-text-tertiary hover:bg-surface-2'}`}>
                  {u.totpEnabled ? '🔐 On' : '○ Off'}
                </button>
              </TD>
              <TD><Badge color={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge></TD>
              <TD className="text-xs text-text-tertiary">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => { setEditing({ ...u, password: '' }); setModal(true) }}>Edit</Btn>
                  {u.id !== currentUserId && (
                    <>
                      <Btn size="sm" variant="ghost" onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(u.id)}>Del</Btn>
                    </>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      </Card>

      {/* Role Guide */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {[
          { role: 'super_admin', label: 'Super Admin', desc: 'Full system access, user management, settings', color: 'yellow' },
          { role: 'administrator', label: 'Administrator', desc: 'All content + settings, no user deletion', color: 'blue' },
          { role: 'editor', label: 'Editor', desc: 'Create and publish content only', color: 'green' },
        ].map((r) => (
          <div key={r.role} className="bg-surface border border-border rounded-xl p-4">
            <Badge color={r.color}>{r.label}</Badge>
            <p className="text-xs text-text-tertiary mt-2">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* User create/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit User' : 'Invite New User'} size="md">
        <div className="space-y-4">
          <Input label="Full Name *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
          <Input label="Email *" type="email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
          <Input label={editing.id ? 'New Password (leave blank to keep current)' : 'Password *'} type="password" value={editing.password} onChange={(v) => setEditing({ ...editing, password: v })} />
          <Select
            label="Role"
            value={editing.role}
            onChange={(v) => setEditing({ ...editing, role: v })}
            options={[{ value: 'editor', label: 'Editor' }, { value: 'administrator', label: 'Administrator' }, { value: 'super_admin', label: 'Super Admin' }]}
          />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : editing.id ? 'Update User' : 'Create User'}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* 2FA management modal */}
      {twoFA && (
        <Modal open={!!twoFA} onClose={() => setTwoFA(null)} title={`Two-Factor Auth — ${twoFA.email}`} size="md">
          <div className="space-y-4">
            {twoFA.phase === 'view' && (
              <>
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                    <p className="text-xs text-text-tertiary mt-0.5">TOTP via Google Authenticator or Authy</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${twoFA.enabled ? 'bg-green-500/15 text-green-400' : 'bg-surface-2 text-text-secondary'}`}>
                    {twoFA.enabled ? '● Enabled' : '○ Disabled'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {!twoFA.enabled
                    ? <Btn onClick={startSetup}>Setup 2FA for this user</Btn>
                    : <Btn variant="danger" onClick={disable2FA} disabled={totpSaving}>Disable 2FA</Btn>
                  }
                  <Btn variant="secondary" onClick={() => setTwoFA(null)}>Close</Btn>
                </div>
              </>
            )}

            {twoFA.phase === 'setup' && (
              <>
                <p className="text-xs text-text-secondary">Step 1 — Have the user scan this QR code in Google Authenticator:</p>
                <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={twoFA.qrCode} alt="2FA QR Code" className="w-44 h-44" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">Or enter this secret manually:</p>
                  <code className="block bg-background border border-border rounded-lg px-3 py-2 text-xs text-brand tracking-widest break-all select-all">{twoFA.secret}</code>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-2">Step 2 — Enter the 6-digit code from the app to confirm:</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-3 py-3 text-2xl text-white text-center tracking-[0.4em] font-mono focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <Btn onClick={confirmEnable} disabled={totpSaving || totpCode.length < 6}>
                    {totpSaving ? 'Verifying...' : 'Activate 2FA'}
                  </Btn>
                  <Btn variant="secondary" onClick={() => setTwoFA({ ...twoFA, phase: 'view' })}>Cancel</Btn>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
