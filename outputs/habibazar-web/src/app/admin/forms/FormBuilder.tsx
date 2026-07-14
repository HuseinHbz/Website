'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, Select, PageHeader, Badge, Modal, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'
import { DataTable, type RowAction } from '@/components/admin/DataTable'
import type { Column } from '@/lib/admin/dataTable'
import { useT } from '@/lib/admin/locale'

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
  const t = useT()
  const locale = useAdminLocale()
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
    if (res.ok) { toast(t('saved')); setModal(false); load() } else toast(t('failed'), 'error')
  }

  async function del(id: number) {
    if (!confirm('Delete this form?')) return
    await fetch('/api/admin/forms', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast(t('deleted')); load()
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
      <PageHeader title={t('formBuilderTitle')} action={<Btn onClick={openNew}>{t('addForm')}</Btn>} />

      <Card>
        <DataTable
          tableId="forms"
          columns={[
            { key: 'name', labelEn: 'Form', labelFa: 'فرم', render: f => <div><div className="font-medium text-text-primary">{f.name}</div><div className="text-xs text-text-tertiary">/{f.slug}</div></div> },
            { key: 'type', labelEn: 'Type', labelFa: 'نوع', type: 'enum', options: ['contact', 'consultation', 'newsletter', 'custom'].map(x => ({ value: x, labelEn: x, labelFa: x })), render: f => <Badge color={TYPE_COLOR[f.type]}>{f.type}</Badge> },
            { key: 'fields', labelEn: 'Fields', labelFa: 'فیلدها', type: 'number', numeric: true, value: f => parseFields(f.fieldsJson).length, render: f => <span className="text-text-secondary">{parseFields(f.fieldsJson).length} fields</span> },
            { key: 'emailTo', labelEn: 'Email To', labelFa: 'ایمیل', render: f => <span className="text-text-tertiary text-xs">{f.emailTo || '—'}</span> },
            { key: 'active', labelEn: 'Status', labelFa: 'وضعیت', type: 'boolean', value: f => f.active, render: f => <Badge color={f.active ? 'green' : 'slate'}>{f.active ? 'Active' : 'Inactive'}</Badge> },
          ] as Column<FormEntry>[]}
          rows={formsList}
          locale={locale}
          rowKey={f => String(f.id)}
          rowActions={[
            { id: 'edit', labelEn: 'Edit', labelFa: 'ویرایش', icon: '✎', onClick: f => openEdit(f) },
            { id: 'del', labelEn: 'Delete', labelFa: 'حذف', icon: '🗑', danger: true, onClick: f => del(f.id!) },
          ] as RowAction<FormEntry>[]}
          exportName="forms"
          emptyLabel="No forms yet."
        />
      </Card>

      {/* Form editor modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing.id ? t('editFormTitle') : t('newFormTitle')} size="xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-border pb-3">
          {(['fields', 'settings', 'notifications'] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setActiveTab(tabKey)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${activeTab === tabKey ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
              {tabKey}
            </button>
          ))}
        </div>

        {/* Tab: Fields */}
        {activeTab === 'fields' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input label={t('formNameStar')} value={editing.name} onChange={v => set('name', v)} placeholder="Contact Form" />
              <Input label="Slug *" value={editing.slug} onChange={v => set('slug', v)} placeholder="contact-form" />
              <Select label={t('formType')} value={editing.type} onChange={v => set('type', v as FormEntry['type'])} options={[
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
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{`${t('colFields')} (${fields.length})`}</p>
                <Btn size="sm" onClick={addField}>{t('addField')}</Btn>
              </div>
              {fields.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-text-disabled text-sm">
                  No fields yet — click &quot;Add Field&quot; to start building your form
                </div>
              )}
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveField(idx, -1)} className="text-text-disabled hover:text-text-primary text-xs leading-none">▲</button>
                      <button onClick={() => moveField(idx, 1)} className="text-text-disabled hover:text-text-primary text-xs leading-none">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-tertiary">{FIELD_TYPE_LABELS[field.type]}</span>
                        {field.required && <span className="text-4xs text-red-400 font-bold">REQUIRED</span>}
                        <span className="text-xs font-bold text-brand">{field.width === 'half' ? '½' : '□'}</span>
                      </div>
                      <p className="text-sm text-text-primary">{field.labelEn || '(no label)'}</p>
                      {field.labelFa && <p className="text-xs text-text-tertiary">{field.labelFa}</p>}
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
              <Input label={t('successMsgEn')} value={editing.successMessageEn} onChange={v => set('successMessageEn', v)} multiline rows={3} />
              <Input label={t('successMsgFa')} value={editing.successMessageFa} onChange={v => set('successMessageFa', v)} multiline rows={3} />
            </div>
            <Select label="Status" value={editing.active ? 'true' : 'false'} onChange={v => set('active', v === 'true')} options={[
              { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
            ]} />
          </div>
        )}

        {/* Tab: Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <Input label={t('emailToLabel')} value={editing.emailTo} onChange={v => set('emailTo', v)} placeholder="admin@habibazar.com" type="email" />
            <Input label={t('emailSubjectLabel')} value={editing.emailSubject} onChange={v => set('emailSubject', v)} placeholder="New form submission: {form_name}" />
            <div className="p-4 rounded-lg text-sm text-text-secondary" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <p className="text-xs font-semibold text-brand mb-2">Available placeholders</p>
              <p><code className="text-xs">{'{form_name}'}</code> · <code className="text-xs">{'{field_name}'}</code> · <code className="text-xs">{'{submitted_at}'}</code></p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-border mt-4">
          <Btn onClick={save} disabled={saving}>{saving ? t('saving') : t('saveForm')}</Btn>
          <Btn variant="secondary" onClick={() => setModal(false)}>{t('cancel')}</Btn>
        </div>
      </Modal>

      {/* Field editor modal */}
      <Modal open={fieldModal} onClose={() => setFieldModal(false)} title={editingFieldIdx !== null ? t('editFieldTitle') : t('addFieldTitle')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('fieldType')} value={editingField.type} onChange={v => setF('type', v as FieldType)} options={
              (Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([value, label]) => ({ value, label }))
            } />
            <Select label={t('fieldWidth')} value={editingField.width} onChange={v => setF('width', v as 'full' | 'half')} options={[
              { value: 'full', label: t('fieldFullWidth') }, { value: 'half', label: t('fieldHalfWidth') },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('labelEnStar')} value={editingField.labelEn} onChange={v => setF('labelEn', v)} placeholder="Your Name" />
            <Input label={t('labelFaLabel')} value={editingField.labelFa} onChange={v => setF('labelFa', v)} placeholder="نام شما" />
          </div>
          <Input label={t('placeholder')} value={editingField.placeholder || ''} onChange={v => setF('placeholder', v)} />
          {(editingField.type === 'select' || editingField.type === 'radio') && (
            <Input label={t('optionsPerLine')} value={editingField.options || ''} onChange={v => setF('options', v)} multiline rows={4} placeholder="Option 1&#10;Option 2&#10;Option 3" />
          )}
          <Input label={t('validationPattern')} value={editingField.validation || ''} onChange={v => setF('validation', v)} placeholder="^[0-9]{10}$" />
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setF('required', !editingField.required)}
              className={`w-9 h-5 rounded-full transition-colors relative ${editingField.required ? 'bg-brand' : 'bg-surface-2'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${editingField.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-text-primary">{t('requiredField')}</span>
          </label>
          <div className="flex gap-3">
            <Btn onClick={saveField}>{t('saveField2')}</Btn>
            <Btn variant="secondary" onClick={() => setFieldModal(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
