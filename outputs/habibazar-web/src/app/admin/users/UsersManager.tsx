'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'

type User = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; lastLogin: string }
const EMPTY = { name: '', email: '', password: '', role: 'editor' }
const ROLE_COLOR: Record<string, string> = { super_admin: 'yellow', administrator: 'blue', editor: 'green' }

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string }>(EMPTY)
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  async function load() { const r = await fetch('/api/admin/users'); setUsers(await r.json()) }
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
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Users & Role Management" subtitle="Manage admin panel access and permissions" action={<Btn onClick={() => { setEditing(EMPTY); setModal(true) }}>+ Invite User</Btn>} />

      <Card>
        <Table headers={['User', 'Role', 'Status', 'Last Login', 'Actions']}>
          {users.map((u) => (
            <TR key={u.id}>
              <TD>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{u.name}{u.id === currentUserId && <span className="text-xs text-slate-500 ml-2">(you)</span>}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                </div>
              </TD>
              <TD><Badge color={ROLE_COLOR[u.role] || 'slate'}>{u.role.replace('_', ' ')}</Badge></TD>
              <TD><Badge color={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Inactive'}</Badge></TD>
              <TD className="text-xs text-slate-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</TD>
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
          <div key={r.role} className="bg-[#111122] border border-[#1e1e2e] rounded-xl p-4">
            <Badge color={r.color}>{r.label}</Badge>
            <p className="text-xs text-slate-500 mt-2">{r.desc}</p>
          </div>
        ))}
      </div>

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
    </>
  )
}
