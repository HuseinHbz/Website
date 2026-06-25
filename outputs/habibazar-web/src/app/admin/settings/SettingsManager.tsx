'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'

type Settings = Record<string, string>

const SECTIONS = [
  {
    label: 'General',
    keys: [
      { key: 'site_name', label: 'Site Name' },
      { key: 'site_tagline', label: 'Site Tagline' },
      { key: 'site_url', label: 'Site URL' },
    ],
  },
  {
    label: 'Branding',
    keys: [
      { key: 'logo_text', label: 'Logo Text (initials)' },
      { key: 'logo_url', label: 'Logo Image URL' },
      { key: 'primary_color', label: 'Primary Color', type: 'color' },
      { key: 'accent_color', label: 'Accent Color', type: 'color' },
    ],
  },
  {
    label: 'Contact Information',
    keys: [
      { key: 'contact_email', label: 'Contact Email' },
      { key: 'contact_phone', label: 'Phone Number' },
      { key: 'contact_location_en', label: 'Location (English)' },
      { key: 'contact_location_fa', label: 'Location (Persian)' },
    ],
  },
  {
    label: 'Social Links',
    keys: [
      { key: 'social_linkedin', label: 'LinkedIn URL' },
      { key: 'social_github', label: 'GitHub URL' },
      { key: 'social_twitter', label: 'Twitter/X URL' },
    ],
  },
  {
    label: 'Email Settings (SMTP)',
    keys: [
      { key: 'smtp_host', label: 'SMTP Host' },
      { key: 'smtp_port', label: 'SMTP Port' },
      { key: 'smtp_user', label: 'SMTP Username' },
      { key: 'smtp_pass', label: 'SMTP Password', type: 'password' },
      { key: 'smtp_from', label: 'From Email Address' },
    ],
  },
]

export function SettingsManager() {
  const [settings, setSettings] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then(setSettings)
  }, [])

  function set(k: string, v: string) { setSettings((s) => ({ ...s, [k]: v })) }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSaving(false)
    toast(res.ok ? 'Settings saved' : 'Failed to save', res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader title="System Settings" subtitle="Configure branding, contact info, social links, and email" action={<Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</Btn>} />

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <Card key={section.label} className="p-6">
            <SectionDivider label={section.label} />
            <div className="grid grid-cols-2 gap-4">
              {section.keys.map((k) => (
                <Input
                  key={k.key}
                  label={k.label}
                  type={k.type || 'text'}
                  value={settings[k.key] || ''}
                  onChange={(v) => set(k.key, v)}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
