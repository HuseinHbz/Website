'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useT, useAdminLocale } from '@/lib/admin/locale'
import { formatDateTime } from '@/lib/admin/datetime'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'

type User = { id: string; name: string; email: string; role: string; employeeCode?: string | null; department?: string | null; active: boolean; createdAt: string; lastLogin: string; totpEnabled?: boolean }
const EMPTY = { name: '', email: '', password: '', role: 'editor', department: '' }
const ROLE_COLOR: Record<string, string> = { super_admin: 'yellow', administrator: 'blue', editor: 'green', auditor: 'purple', viewer: 'slate' }

type TwoFAPanel = { userId: string; email: string; secret: string; qrCode: string; enabled: boolean; phase: 'view' | 'setup' | 'confirm' | 'codes'; recoveryLeft?: number; codes?: string[] }

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const lc = (en: string, fa: string) => (rtl ? fa : en)
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
    setTwoFA({ userId: user.id, email: d.email, secret: d.secret, qrCode: d.qrCode, enabled: d.enabled, phase: 'view', recoveryLeft: d.recoveryLeft })
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
      // 26.27 بند ۵.۱ — recovery codes are shown exactly once
      setTwoFA({ ...twoFA, enabled: true, phase: 'codes', codes: d.recoveryCodes, recoveryLeft: (d.recoveryCodes || []).length })
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

  async function regenRecovery() {
    if (!twoFA) return
    setTotpSaving(true)
    const r = await fetch('/api/admin/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recovery', userId: twoFA.userId }),
    })
    const d = await r.json()
    setTotpSaving(false)
    if (r.ok) setTwoFA({ ...twoFA, phase: 'codes', codes: d.recoveryCodes, recoveryLeft: (d.recoveryCodes || []).length })
    else toast(d.error || 'Failed', 'error')
  }

  const userColumns: Column<User>[] = [
    { key: 'name', labelEn: 'User', labelFa: 'کاربر', render: u => <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold">{u.name.charAt(0)}</div><div><div className="font-medium text-text-primary">{u.name}{u.id === currentUserId && <span className="text-xs text-text-tertiary ml-2">(you)</span>}</div><div className="text-xs text-text-tertiary">{u.email}</div></div></div> },
    { key: 'employeeCode', labelEn: 'Code', labelFa: 'کد پرسنلی', render: u => <span className="font-mono text-xs text-text-secondary">{u.employeeCode ?? '—'}</span> },
    { key: 'role', labelEn: 'Role', labelFa: 'نقش', type: 'enum', options: ['super_admin', 'administrator', 'editor', 'auditor', 'viewer'].map(r => ({ value: r, labelEn: r, labelFa: r })), render: u => <Badge color={ROLE_COLOR[u.role] || 'slate'}>{u.role.replace('_', ' ')}</Badge> },
    { key: 'totpEnabled', labelEn: '2FA', labelFa: '2FA', type: 'boolean', value: u => !!u.totpEnabled, render: u => <button onClick={() => open2FA(u)} className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${u.totpEnabled ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-surface-2/50 text-text-tertiary hover:bg-surface-2'}`}>{u.totpEnabled ? '🔐 On' : '○ Off'}</button> },
    { key: 'active', labelEn: 'Status', labelFa: 'وضعیت', type: 'boolean', value: u => u.active, render: u => <Badge color={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'lastLogin', labelEn: 'Last Login', labelFa: 'آخرین ورود', type: 'date', render: u => <span className="text-xs text-text-tertiary tabular-nums">{formatDateTime(u.lastLogin, locale)}</span> },
  ]
  const userActions: RowAction<User>[] = [
    { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎', onClick: u => { setEditing({ ...u, password: '', department: u.department ?? '' }); setModal(true) } },
    { id: 'perms', labelEn: 'Permissions', labelFa: 'دسترسی‌ها', icon: '🌳', onClick: u => { window.location.href = `/admin/users/${u.id}/permissions` } },
    { id: 'toggle', labelEn: 'Enable/Disable', labelFa: 'فعال/غیرفعال', icon: '⇄', hidden: u => u.id === currentUserId, onClick: u => toggleActive(u) },
    { id: 'del', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true, hidden: u => u.id === currentUserId, onClick: u => del(u.id) },
  ]

  return (
    <>
      <ToastContainer />
      <PageHeader title={lc('Users & Role Management', 'مدیریت کاربران و نقش‌ها')} subtitle={lc('Manage admin panel access and permissions', 'مدیریت دسترسی و مجوزهای پنل ادمین')} action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>{lc('+ Invite User', '+ دعوت کاربر')}</Btn>} />

      <Card>
        <DataTable
          tableId="users"
          columns={userColumns}
          rows={users}
          locale={locale}
          rowKey={u => u.id}
          rowActions={userActions}
          exportName="users"
          quickCreate={{ labelEn: 'Invite User', labelFa: 'دعوت کاربر', onClick: () => { setEditing(EMPTY); setModal(true) } }}
        />
      </Card>

      {/* Role Guide */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
        {[
          { role: 'super_admin', label: lc('Super Admin', 'مدیر ارشد'), desc: lc('Full system access, user management, settings', 'دسترسی کامل به سیستم، مدیریت کاربران، تنظیمات'), color: 'yellow' },
          { role: 'administrator', label: lc('Administrator', 'مدیر'), desc: lc('All content + settings, no user deletion', 'تمام محتوا + تنظیمات، بدون حذف کاربر'), color: 'blue' },
          { role: 'editor', label: lc('Editor', 'ویرایشگر'), desc: lc('Create and publish content only', 'فقط ایجاد و انتشار محتوا'), color: 'green' },
          { role: 'auditor', label: lc('Auditor', 'حسابرس'), desc: lc('Read-only everything + audit trail & logs; cannot change any record', 'فقط خواندنی همه‌چیز + ردیابی و لاگ‌ها؛ نمی‌تواند هیچ رکوردی را تغییر دهد'), color: 'purple' },
          { role: 'viewer', label: lc('Viewer / Shareholder', 'بیننده / سهامدار'), desc: lc('Executive dashboards, analytics and reports only', 'فقط داشبوردهای اجرایی، تحلیل‌ها و گزارش‌ها'), color: 'slate' },
        ].map((r) => (
          <div key={r.role} className="bg-surface border border-border rounded-xl p-4">
            <Badge color={r.color}>{r.label}</Badge>
            <p className="text-xs text-text-tertiary mt-2">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* User create/edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? lc('Edit User', 'ویرایش کاربر') : lc('Invite New User', 'دعوت کاربر جدید')} size="md">
        <div className="space-y-4">
          <Input label={lc('Full Name *', 'نام کامل *')} value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
          <Input label={lc('Email *', 'ایمیل *')} type="email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
          <Input label={editing.id ? lc('New Password (leave blank to keep current)', 'رمز عبور جدید (برای حفظ رمز فعلی خالی بگذارید)') : lc('Password *', 'رمز عبور *')} type="password" value={editing.password} onChange={(v) => setEditing({ ...editing, password: v })} />
          <Select
            label={lc('Role', 'نقش')}
            value={editing.role}
            onChange={(v) => setEditing({ ...editing, role: v })}
            options={[{ value: 'editor', label: lc('Editor', 'ویرایشگر') }, { value: 'administrator', label: lc('Administrator', 'مدیر') }, { value: 'super_admin', label: lc('Super Admin', 'مدیر ارشد') }, { value: 'auditor', label: lc('Auditor (read-only)', 'حسابرس (فقط خواندنی)') }, { value: 'viewer', label: lc('Viewer / Shareholder', 'بیننده / سهامدار') }]}
          />
          <Input label={lc('Department / Team', 'واحد / تیم')} value={editing.department ?? ''} onChange={(v) => setEditing({ ...editing, department: v })} />
          <div className="flex gap-3">
            <Btn onClick={save} disabled={saving}>{saving ? t('saving') : editing.id ? lc('Update User', 'به‌روزرسانی کاربر') : lc('Create User', 'ایجاد کاربر')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>

      {/* 2FA management modal */}
      {twoFA && (
        <Modal open={!!twoFA} onClose={() => setTwoFA(null)} title={lc(`Two-Factor Auth — ${twoFA.email}`, `احراز دو مرحله‌ای — ${twoFA.email}`)} size="md">
          <div className="space-y-4">
            {twoFA.phase === 'view' && (
              <>
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{lc('Two-Factor Authentication', 'احراز دو مرحله‌ای')}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{lc('TOTP via Google Authenticator or Authy', 'TOTP از طریق Google Authenticator یا Authy')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${twoFA.enabled ? 'bg-green-500/15 text-green-400' : 'bg-surface-2 text-text-secondary'}`}>
                    {twoFA.enabled ? lc('● Enabled', '● فعال') : lc('○ Disabled', '○ غیرفعال')}
                  </span>
                </div>
                {twoFA.enabled && (
                  <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{lc('Recovery codes', 'کدهای بازیابی')}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">{lc(`${twoFA.recoveryLeft ?? 0} unused single-use codes remaining`, `${twoFA.recoveryLeft ?? 0} کد یک‌بارمصرف استفاده‌نشده باقی‌مانده`)}</p>
                    </div>
                    <Btn variant="secondary" onClick={regenRecovery} disabled={totpSaving}>{lc('Regenerate', 'تولید مجدد')}</Btn>
                  </div>
                )}
                <div className="flex gap-2">
                  {!twoFA.enabled
                    ? <Btn onClick={startSetup}>{lc('Setup 2FA for this user', 'راه‌اندازی 2FA برای این کاربر')}</Btn>
                    : <Btn variant="danger" onClick={disable2FA} disabled={totpSaving}>{lc('Disable 2FA', 'غیرفعال‌سازی 2FA')}</Btn>
                  }
                  <Btn variant="secondary" onClick={() => setTwoFA(null)}>{t('close')}</Btn>
                </div>
              </>
            )}

            {twoFA.phase === 'setup' && (
              <>
                <p className="text-xs text-text-secondary">{lc('Step 1 — Have the user scan this QR code in Google Authenticator:', 'مرحله ۱ — از کاربر بخواهید این کد QR را در Google Authenticator اسکن کند:')}</p>
                <div className="flex justify-center p-4 bg-surface rounded-xl w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={twoFA.qrCode} alt="2FA QR Code" className="w-44 h-44" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1">{lc('Or enter this secret manually:', 'یا این کلید مخفی را به‌صورت دستی وارد کنید:')}</p>
                  <code className="block bg-background border border-border rounded-lg px-3 py-2 text-xs text-brand tracking-widest break-all select-all">{twoFA.secret}</code>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-2">{lc('Step 2 — Enter the 6-digit code from the app to confirm:', 'مرحله ۲ — کد ۶ رقمی اپ را برای تأیید وارد کنید:')}</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg px-3 py-3 text-2xl text-text-primary text-center tracking-[0.4em] font-mono focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <Btn onClick={confirmEnable} disabled={totpSaving || totpCode.length < 6}>
                    {totpSaving ? lc('Verifying...', 'در حال تأیید...') : lc('Activate 2FA', 'فعال‌سازی 2FA')}
                  </Btn>
                  <Btn variant="secondary" onClick={() => setTwoFA({ ...twoFA, phase: 'view' })}>{t('cancel')}</Btn>
                </div>
              </>
            )}

            {twoFA.phase === 'codes' && (
              <>
                <p className="text-sm font-medium text-text-primary">{lc('Recovery codes — shown only once', 'کدهای بازیابی — فقط یک‌بار نمایش داده می‌شود')}</p>
                <p className="text-xs text-text-secondary">{lc('Save these single-use codes somewhere safe. Each can be used once instead of an authenticator code if the device is lost.', 'این کدهای یک‌بارمصرف را در جای امنی ذخیره کنید. هر کد در صورت گم‌شدن دستگاه، یک‌بار به‌جای کد احرازهویت قابل استفاده است.')}</p>
                <div className="grid grid-cols-2 gap-2 p-3 bg-background border border-border rounded-xl">
                  {(twoFA.codes || []).map(c => <code key={c} className="text-xs font-mono text-brand tracking-wider select-all">{c}</code>)}
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" onClick={() => { navigator.clipboard?.writeText((twoFA.codes || []).join('\n')); toast(lc('Copied', 'کپی شد')) }}>{lc('Copy all', 'کپی همه')}</Btn>
                  <Btn onClick={() => setTwoFA(null)}>{lc('Done', 'تمام شد')}</Btn>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
