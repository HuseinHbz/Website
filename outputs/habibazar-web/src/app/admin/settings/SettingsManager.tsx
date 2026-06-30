'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type Settings = Record<string, string>

const AI_PROVIDERS = [
  { value: 'chatgpt', label: 'ChatGPT (OpenAI)' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'grok', label: 'Grok (xAI)' },
  { value: 'copilot', label: 'Copilot (Microsoft)' },
  { value: 'conduit', label: 'Conduit (Multi-model)' },
]

const AI_PROVIDER_DEFAULTS: Record<string, { url: string; model: string }> = {
  chatgpt:  { url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  claude:   { url: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
  gemini:   { url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
  grok:     { url: 'https://api.x.ai/v1', model: 'grok-beta' },
  copilot:  { url: 'https://api.github.com/copilot', model: 'gpt-4o' },
  conduit:  { url: 'https://conduit.ozdoev.net/api/v1', model: 'anthropic/claude-sonnet-4-6' },
}

const NOTIFICATION_KEYS = [
  { key: 'notify_email_consultations', label: 'Send consultation requests to email' },
  { key: 'notify_email_contacts', label: 'Send contact form submissions to email' },
  { key: 'notify_email_reports', label: 'Send weekly reports to email' },
  { key: 'notify_sms_consultations', label: 'Send consultation alerts via SMS' },
  { key: 'notify_sms_contacts', label: 'Send contact alerts via SMS' },
]

export function SettingsManager() {
  const [settings, setSettings] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/settings').then((r) => r.json()).then(setSettings)
  }, [])

  function set(k: string, v: string) { setSettings((s) => ({ ...s, [k]: v })) }
  function toggle(k: string) { set(k, settings[k] === '1' ? '0' : '1') }

  function setAiProvider(provider: string) {
    const defaults = AI_PROVIDER_DEFAULTS[provider]
    setSettings((s) => ({
      ...s,
      ai_provider: provider,
      ai_api_url: defaults?.url || '',
      ai_model: defaults?.model || '',
    }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    toast(res.ok ? 'Settings saved' : 'Failed to save', res.ok ? 'success' : 'error')
  }

  const currentProvider = settings['ai_provider'] || 'chatgpt'

  return (
    <>
      <ToastContainer />
      <PageHeader
        title="System Settings"
        subtitle="Configure branding, contact info, social links, AI, and notifications"
        action={<Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</Btn>}
      />

      <div className="space-y-6">
        {/* General */}
        <Card className="p-6">
          <SectionDivider label="General" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'site_name', label: 'Site Name' },
              { key: 'site_tagline', label: 'Site Tagline' },
              { key: 'site_url', label: 'Site URL' },
            ].map((k) => (
              <Input key={k.key} label={k.label} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Branding */}
        <Card className="p-6">
          <SectionDivider label="Branding" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'logo_text', label: 'Logo Text (initials)' },
              { key: 'logo_url', label: 'Logo Image URL' },
              { key: 'primary_color', label: 'Primary Color', type: 'color' },
              { key: 'accent_color', label: 'Accent Color', type: 'color' },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <SectionDivider label="Contact Information" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'contact_email', label: 'Contact Email' },
              { key: 'contact_phone', label: 'Phone Number' },
              { key: 'contact_location_en', label: 'Location (English)' },
              { key: 'contact_location_fa', label: 'Location (Persian)' },
            ].map((k) => (
              <Input key={k.key} label={k.label} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Social Links */}
        <Card className="p-6">
          <SectionDivider label="Social Links" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'social_linkedin', label: 'LinkedIn URL' },
              { key: 'social_github', label: 'GitHub URL' },
              { key: 'social_twitter', label: 'Twitter/X URL' },
              { key: 'social_instagram', label: 'Instagram URL' },
            ].map((k) => (
              <Input key={k.key} label={k.label} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Profile & Resume */}
        <Card className="p-6">
          <SectionDivider label="Profile & Resume" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'profile_photo_url', label: 'Profile Photo URL' },
              { key: 'resume_url', label: 'Resume / CV URL' },
            ].map((k) => (
              <Input key={k.key} label={k.label} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Email Settings */}
        <Card className="p-6">
          <SectionDivider label="Email Settings (SMTP)" />
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { key: 'smtp_host', label: 'SMTP Host' },
              { key: 'smtp_port', label: 'SMTP Port' },
              { key: 'smtp_user', label: 'SMTP Username' },
              { key: 'smtp_pass', label: 'SMTP Password', type: 'password' },
              { key: 'smtp_from', label: 'From Email Address' },
              { key: 'notify_email_to', label: 'Notification Recipient Email' },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
          <div className="border-t border-[#2a2a3e] pt-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Email Notifications</p>
            <div className="space-y-3">
              {NOTIFICATION_KEYS.filter(k => k.key.startsWith('notify_email')).map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings[item.key] === '1' ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[item.key] === '1' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* SMS Settings */}
        <Card className="p-6">
          <SectionDivider label="SMS Notifications (sms.ir)" />
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { key: 'sms_ir_api_key', label: 'sms.ir API Key', type: 'password' },
              { key: 'sms_ir_line', label: 'SMS Line Number' },
              { key: 'sms_notify_to', label: 'Notification Phone Number' },
              { key: 'sms_template_consult', label: 'Consultation Template ID' },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
          <div className="border-t border-[#2a2a3e] pt-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">SMS Notifications</p>
            <div className="space-y-3">
              {NOTIFICATION_KEYS.filter(k => k.key.startsWith('notify_sms')).map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings[item.key] === '1' ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[item.key] === '1' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Chatbot */}
        <Card className="p-6">
          <SectionDivider label="AI Chatbot / Assistant" />
          <div className="mb-4">
            <p className="text-xs text-slate-500 font-medium mb-2">AI Provider</p>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAiProvider(p.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentProvider === p.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#1e1e2e] text-slate-400 hover:text-white hover:bg-[#2a2a3e]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="API Key"
              type="password"
              value={settings['ai_api_key'] || ''}
              onChange={(v) => set('ai_api_key', v)}
            />
            <Input
              label="Model Name"
              value={settings['ai_model'] || AI_PROVIDER_DEFAULTS[currentProvider]?.model || ''}
              onChange={(v) => set('ai_model', v)}
            />
            <Input
              label="API Base URL (auto-filled)"
              value={settings['ai_api_url'] || AI_PROVIDER_DEFAULTS[currentProvider]?.url || ''}
              onChange={(v) => set('ai_api_url', v)}
            />
            <Input
              label="Max Conversation Turns"
              value={settings['ai_max_turns'] || '10'}
              onChange={(v) => set('ai_max_turns', v)}
            />
            <Input
              label="System Prompt (optional)"
              value={settings['ai_system_prompt'] || ''}
              onChange={(v) => set('ai_system_prompt', v)}
            />
          </div>
        </Card>
      </div>
    </>
  )
}
