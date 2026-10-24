'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useAdminLocale } from '@/lib/admin/locale'

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
  { key: 'notify_email_consultations', labelEn: 'Send consultation requests to email', labelFa: 'ارسال درخواست‌های مشاوره به ایمیل' },
  { key: 'notify_email_contacts', labelEn: 'Send contact form submissions to email', labelFa: 'ارسال فرم‌های تماس به ایمیل' },
  { key: 'notify_email_reports', labelEn: 'Send weekly reports to email', labelFa: 'ارسال گزارش‌های هفتگی به ایمیل' },
  { key: 'notify_sms_consultations', labelEn: 'Send consultation alerts via SMS', labelFa: 'ارسال هشدار مشاوره از طریق پیامک' },
  { key: 'notify_sms_contacts', labelEn: 'Send contact alerts via SMS', labelFa: 'ارسال هشدار تماس از طریق پیامک' },
]

export function SettingsManager() {
  const locale = useAdminLocale()
  const rtl = locale === 'fa'
  const lc = (en: string, fa: string) => (rtl ? fa : en)
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
        title={lc('System Settings', 'تنظیمات سیستم')}
        subtitle={lc('Configure branding, contact info, social links, AI, and notifications', 'پیکربندی برندینگ، اطلاعات تماس، لینک‌های اجتماعی، هوش مصنوعی و اعلان‌ها')}
        action={<Btn onClick={save} disabled={saving}>{saving ? lc('Saving...', 'در حال ذخیره...') : lc('Save All Settings', 'ذخیره همه تنظیمات')}</Btn>}
      />

      <div className="space-y-6">
        {/* General */}
        <Card className="p-6">
          <SectionDivider label={lc('General', 'عمومی')} />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'site_name', label: lc('Site Name', 'نام سایت') },
              { key: 'site_tagline', label: lc('Site Tagline', 'شعار سایت') },
              { key: 'site_url', label: lc('Site URL', 'آدرس سایت') },
            ].map((k) => (
              <Input key={k.key} label={k.label} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Branding */}
        <Card className="p-6">
          <SectionDivider label={lc('Branding', 'برندینگ')} />
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'logo_text', label: lc('Logo Text (initials)', 'متن لوگو (حروف اول)') },
              { key: 'logo_url', label: lc('Logo Image URL', 'آدرس تصویر لوگو') },
              { key: 'primary_color', label: lc('Primary Color', 'رنگ اصلی'), type: 'color' },
              { key: 'accent_color', label: lc('Accent Color', 'رنگ تأکیدی'), type: 'color' },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
        </Card>

        {/* Contact info & social links are managed under «پروفایل اجرایی» (/admin/about) */}

        {/* Profile photo & resume are managed under «پروفایل اجرایی» (/admin/about) */}

        {/* Email Settings */}
        <Card className="p-6">
          <SectionDivider label={lc('Email Settings (SMTP)', 'تنظیمات ایمیل (SMTP)')} />
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { key: 'smtp_host', label: lc('SMTP Host', 'میزبان SMTP') },
              { key: 'smtp_port', label: lc('SMTP Port', 'پورت SMTP') },
              { key: 'smtp_user', label: lc('SMTP Username', 'نام کاربری SMTP') },
              { key: 'smtp_pass', label: lc('SMTP Password', 'رمز عبور SMTP'), type: 'password' },
              { key: 'smtp_from', label: lc('From Email Address', 'آدرس ایمیل فرستنده') },
              { key: 'notify_email_to', label: lc('Notification Recipient Email', 'ایمیل دریافت‌کننده اعلان') },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-3">{lc('Email Notifications', 'اعلان‌های ایمیلی')}</p>
            <div className="space-y-3">
              {NOTIFICATION_KEYS.filter(k => k.key.startsWith('notify_email')).map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings[item.key] === '1' ? 'bg-brand' : 'bg-surface-2'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${settings[item.key] === '1' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-text-primary group-hover:text-text-primary transition-colors">{lc(item.labelEn, item.labelFa)}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* SMS Settings */}
        <Card className="p-6">
          <SectionDivider label={lc('SMS Notifications (sms.ir)', 'اعلان‌های پیامکی (sms.ir)')} />
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { key: 'sms_ir_api_key', label: lc('sms.ir API Key', 'کلید API sms.ir'), type: 'password' },
              { key: 'sms_ir_line', label: lc('SMS Line Number', 'شماره خط پیامک') },
              { key: 'sms_notify_to', label: lc('Notification Phone Number', 'شماره تلفن اعلان') },
              { key: 'sms_template_consult', label: lc('Consultation Template ID', 'شناسه قالب مشاوره') },
            ].map((k) => (
              <Input key={k.key} label={k.label} type={k.type || 'text'} value={settings[k.key] || ''} onChange={(v) => set(k.key, v)} />
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-3">{lc('SMS Notifications', 'اعلان‌های پیامکی')}</p>
            <div className="space-y-3">
              {NOTIFICATION_KEYS.filter(k => k.key.startsWith('notify_sms')).map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                  <button
                    type="button"
                    onClick={() => toggle(item.key)}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${settings[item.key] === '1' ? 'bg-brand' : 'bg-surface-2'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${settings[item.key] === '1' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-text-primary group-hover:text-text-primary transition-colors">{lc(item.labelEn, item.labelFa)}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Chatbot */}
        <Card className="p-6">
          <SectionDivider label={lc('AI Chatbot / Assistant', 'چت‌بات / دستیار هوش مصنوعی')} />
          <div className="mb-4">
            <p className="text-xs text-text-tertiary font-medium mb-2">{lc('AI Provider', 'ارائه‌دهنده هوش مصنوعی')}</p>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAiProvider(p.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentProvider === p.value
                      ? 'bg-brand text-white'
                      : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={lc('API Key', 'کلید API')}
              type="password"
              value={settings['ai_api_key'] || ''}
              onChange={(v) => set('ai_api_key', v)}
            />
            <Input
              label={lc('Model Name', 'نام مدل')}
              value={settings['ai_model'] || AI_PROVIDER_DEFAULTS[currentProvider]?.model || ''}
              onChange={(v) => set('ai_model', v)}
            />
            <Input
              label={lc('API Base URL (auto-filled)', 'آدرس پایه API (پر شده خودکار)')}
              value={settings['ai_api_url'] || AI_PROVIDER_DEFAULTS[currentProvider]?.url || ''}
              onChange={(v) => set('ai_api_url', v)}
            />
            <Input
              label={lc('Max Conversation Turns', 'حداکثر نوبت‌های گفتگو')}
              value={settings['ai_max_turns'] || '10'}
              onChange={(v) => set('ai_max_turns', v)}
            />
            <Input
              label={lc('System Prompt (optional)', 'پرامپت سیستم (اختیاری)')}
              value={settings['ai_system_prompt'] || ''}
              onChange={(v) => set('ai_system_prompt', v)}
            />
          </div>
        </Card>
      </div>
    </>
  )
}
