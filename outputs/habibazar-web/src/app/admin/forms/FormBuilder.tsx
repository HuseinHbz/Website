'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Table, TR, TD, Badge, Modal, useToast } from '@/components/admin/ui'

type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'number' | 'date' | 'hidden'

interface FormField {
  id: string
  type: FieldType
  labelEn: string
  labelFa: string
  placeholder?: string
  required: boolean
  options?: string
  validation?: string
  width: 'full' | 'half'
}

interface FormEntry {
  id?: number
  name: string
  slug: string
  description: string
  type: 'contact' | 'consultation' | 'newsletter' | 'custom'
  fieldsJson: string
  emailTo: string
  emailSubject: string
  successMessageEn: string
  successMessageFa: string
  active: boolean
}

const EMPTY: FormEntry = {
  name: '', slug: '', description: '', type: 'contact',
  fieldsJson: '[]', emailTo: '', emailSubject: '',
  successMessageEn: 'Thank you! We will get back to you soon.',
  successMessageFa: 'با تشکر! به زودی با شما تماس خواهیم گرفت.',
  active: true,
}

const EMPTY_FIELD: FormField = {
  id: '', type: 'text', labelEn: '', labelFa: '', placeholder: '', required: false, options: '', validation: '', width: 'full',
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text', email: 'Email', phone: 'Phone', textarea: 'Textarea',
  select: 'Dropdown', checkbox: 'Checkbox', radio: 'Radio', file: 'File Upload',
  number: 'Number', date: 'Date', hidden: 'Hidden',
}

const TYPE_COLOR: Record<string, string> = { contact: 'blue', consultation: 'green', newsletter: 'indigo', custom: 'yellow' }

function parseFields(json: string): FormField[] {
  try { return JSON.parse(json) } catch { return [] }
}

export function FormBuilder() {
  const [formsList, setFormsList] = useState<FormEntry[]>([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<FormEntry>(EMPTY)
  const [fields, setFields] = useState<FormField[]>([])
  const [fieldModal, setFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<FormField>(EMPTY_FIELD)
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'fields' | 'settings' | 'notifications'>('fields')
  const { toast, ToastContainer } = useToast()

  async function load() {
    const r = await fetch('/api/admin/forms')
    const d = await r.json()
    setFormsList(Array.isArray(d) ? d : [])
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(EMPTY)
    setFields([])
    setActiveTab('fields')
    setModal(true)
  }

  function openEdit(f: FormEntry) {
    setEditing(f)
    setFields(parseFields(f.fieldsJson))
    setActiveTab('fields')
    setModal(true)
  }

  async function save() {
    setSaving(true)
    const payload = { ...editing, fieldsJson: JSON.stringify(fields) }
    const res = await fetch('/api/admin/forms', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { toast('Form saved'); setModal(false); load() } else toast('Failed', 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete this form?')) return
    await fetch('/api/admin/forms', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast('Deleted'); load()
  }

  function addField() {
    setEditingField({ ...EMPTY_FIELD, id: `field_${Date.now()}` })
    setEditingFieldIdx(null)
    setFieldModal(true)
  }

  function editField(idx: number) {
    setEditingField({ ...fields[idx] })
    setEditingFieldIdx(idx)
    setFieldModal(true)
  }

  function saveField() {
    if (editingFieldIdx !== null) {
      setFields(prev => prev.map((f, i) => i === editingFieldIdx ? editingField : f))
    } else {
      setFields(prev => [...prev, editingField])
    }
    setFieldModal(false)
  }

  function removeField(idx: number) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  function moveField(idx: number, dir: -1 | 1) {
    const next = [...fields]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setFields(next)
  }

  function set<K extends keyof FormEntry>(k: K, v: FormEntry[K]) { setEditing(e => ({ ...e, [k]: v })) }
  function setF<K extends keyof FormField>(k: K, v: FormField[K]) { setEditingField(e => ({ ...e, [k]: v })) }

  return (
    <>
      <ToastContainer />
      <PageHeader title="Form Builder" action={<Btn onClick={openNew}>+ New Form</Btn>} />

      <Card>
        <Table headers={['Form', 'Type', 'Fields', 'Email To', 'Status', 'Actions']}>
          {formsList.map(f => (
            <TR key={f.id}>
              <TD>
                <div className="font-medium text-white">{f.name}</div>
                <div className="text-xs text-slate-500">/{f.slug}</div>
              </TD>
              <TD><Badge color={TYPE_COLOR[f.type]}>{f.type}</Badge></TD>
              <TD className="text-slate-400">{parseFields(f.fieldsJson).length} fields</TD>
              <TD className="text-slate-500 text-xs truncate max-w-[120px]">{f.emailTo || '—'}</TD>
              <TD><Badge color={f.active ? 'green' : 'slate'}>{f.active ? 'Active' : 'Inactive'}</Badge></TD>
              <TD>
                <div className="flex gap-2">
                  <Btn size="sm" variant="secondary" onClick={() => openEdit(f)}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(f.id!)}>Del</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
        {formsList.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">No forms yet. Create your first form.</div>}
      </Card>

      {/* Form editor modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? 'Edit Form' : 'New Form'} size="xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-[#1e1e2e] pb-3">
          {(['fields', 'settings', 'notifications'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Fields */}
        {activeTab === 'fields' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Form Name *" value={editing.name} onChange={v => set('name', v)} placeholder="Contact Form" />
              <Input label="Slug *" value={editing.slug} onChange={v => set('slug', v)} placeholder="contact-form" />
              <Select label="Form Type" value={editing.type} onChange={v => set('type', v as FormEntry['type'])} options={[
                { value: 'contact', label: 'Contact' },
                { value: 'consultation', label: 'Consultation' },
                { value: 'newsletter', label: 'Newsletter' },
                { value: 'custom', label: 'Custom' },
              ]} />
            </div>
            <Input label="Description" value={editing.description} onChange={v => set('description', v)} placeholder="Optional description" />

            {/* Field list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Form Fields ({fields.length})</p>
                <Btn size="sm" onClick={addField}>+ Add Field</Btn>
              </div>
              {fields.length === 0 && (
                <div className="border-2 border-dashed border-[#2a2a3e] rounded-xl p-8 text-center text-slate-600 text-sm">
                  No fields yet — click "Add Field" to start building your form
                </div>
              )}
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveField(idx, -1)} className="text-slate-600 hover:text-white text-xs leading-none">▲</button>
                      <button onClick={() => moveField(idx, 1)} className="text-slate-600 hover:text-white text-xs leading-none">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{FIELD_TYPE_LABELS[field.type]}</span>
                        {field.required && <span className="text-[9px] text-red-400 font-bold">REQUIRED</span>}
                        <span className="text-xs font-bold text-indigo-400">{field.width === 'half' ? '½' : '□'}</span>
                      </div>
                      <p className="text-sm text-white">{field.labelEn || '(no label)'}</p>
                      {field.labelFa && <p className="text-xs text-slate-500">{field.labelFa}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => editField(idx)}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => removeField(idx)}>✕</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Success Message (EN)" value={editing.successMessageEn} onChange={v => set('successMessageEn', v)} multiline rows={3} />
              <Input label="Success Message (FA)" value={editing.successMessageFa} onChange={v => set('successMessageFa', v)} multiline rows={3} />
            </div>
            <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={v => set('active', v === 'true')} options={[
              { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
            ]} />
          </div>
        )}

        {/* Tab: Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <Input label="Send submissions to email" value={editing.emailTo} onChange={v => set('emailTo', v)} placeholder="admin@habibazar.com" type="email" />
            <Input label="Email Subject" value={editing.emailSubject} onChange={v => set('emailSubject', v)} placeholder="New form submission: {form_name}" />
            <div className="p-4 rounded-lg text-sm text-slate-400" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <p className="text-xs font-semibold text-indigo-400 mb-2">Available placeholders</p>
              <p><code className="text-xs">{'{form_name}'}</code> · <code className="text-xs">{'{field_name}'}</code> · <code className="text-xs">{'{submitted_at}'}</code></p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-[#1e1e2e] mt-4">
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Form'}</Btn>
          <Btn variant="secondary" onClick={() => setModal(false)}>Cancel</Btn>
        </div>
      </Modal>

      {/* Field editor modal */}
      <Modal open={fieldModal} onClose={() => setFieldModal(false)} title={editingFieldIdx !== null ? 'Edit Field' : 'Add Field'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Field Type" value={editingField.type} onChange={v => setF('type', v as FieldType)} options={
              (Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([value, label]) => ({ value, label }))
            } />
            <Select label="Width" value={editingField.width} onChange={v => setF('width', v as 'full' | 'half')} options={[
              { value: 'full', label: 'Full width' }, { value: 'half', label: 'Half width' },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Label (EN) *" value={editingField.labelEn} onChange={v => setF('labelEn', v)} placeholder="Your Name" />
            <Input label="Label (FA)" value={editingField.labelFa} onChange={v => setF('labelFa', v)} placeholder="نام شما" />
          </div>
          <Input label="Placeholder" value={editingField.placeholder || ''} onChange={v => setF('placeholder', v)} />
          {(editingField.type === 'select' || editingField.type === 'radio') && (
            <Input label="Options (one per line)" value={editingField.options || ''} onChange={v => setF('options', v)} multiline rows={4} placeholder="Option 1&#10;Option 2&#10;Option 3" />
          )}
          <Input label="Validation pattern (regex, optional)" value={editingField.validation || ''} onChange={v => setF('validation', v)} placeholder="^[0-9]{10}$" />
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setF('required', !editingField.required)}
              className={`w-9 h-5 rounded-full transition-colors relative ${editingField.required ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editingField.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-300">Required field</span>
          </label>
          <div className="flex gap-3">
            <Btn onClick={saveField}>Save Field</Btn>
            <Btn variant="secondary" onClick={() => setFieldModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
