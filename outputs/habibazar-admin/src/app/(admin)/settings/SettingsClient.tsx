'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Setting } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

const AI_PROVIDERS = [
  { value: 'openai', label: 'ChatGPT (OpenAI)' },
  { value: 'anthropic', label: 'Claude (Anthropic)' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'grok', label: 'Grok (xAI)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'conduit', label: 'Conduit (Multi-model Gateway)' },
]

const CONDUIT_MODELS = [
  'anthropic/claude-sonnet-4-6',
  'openai/gpt-4o',
  'openai/gpt-5',
  'google/gemini-2.5-pro',
  'deepseek/deepseek-v3-2',
  'meta/llama-4-maverick',
]

async function saveSetting(key: string, value: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/admin/settings/${key}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Save failed')
  }
}

function AiProviderSection({ settings }: { settings: Setting[] }) {
  const getVal = (key: string) => settings.find(s => s.key === key)?.value ?? ''

  const [provider, setProvider] = useState(getVal('ai_provider') || 'openai')
  const [apiKey, setApiKey] = useState(getVal('ai_api_key'))
  const [model, setModel] = useState(getVal('ai_model'))
  const [baseUrl, setBaseUrl] = useState(getVal('ai_base_url'))
  const [systemPrompt, setSystemPrompt] = useState(getVal('ai_system_prompt'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await Promise.all([
        saveSetting('ai_provider', provider),
        saveSetting('ai_api_key', apiKey),
        saveSetting('ai_model', model),
        saveSetting('ai_base_url', baseUrl),
        saveSetting('ai_system_prompt', systemPrompt),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const isConduit = provider === 'conduit'
  const defaultBaseUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    grok: 'https://api.x.ai/v1',
    deepseek: 'https://api.deepseek.com/v1',
    ollama: 'http://localhost:11434',
    conduit: 'https://conduit.ozdoev.net/api/v1',
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-text-primary">AI Assistant Provider</h3>
          <p className="text-xs text-text-muted">Configure the AI provider for the website chat assistant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Provider</label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="form-input text-sm"
          >
            {AI_PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {isConduit && (
            <p className="text-xs text-text-muted mt-1">
              Conduit is an OpenAI-compatible multi-model gateway. Use model format: <code className="text-accent">provider/model-name</code>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={isConduit ? 'sk-cdt-...' : 'sk-...'}
            className="form-input text-sm font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Model</label>
          {isConduit ? (
            <div className="space-y-1">
              <input
                list="conduit-models"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="anthropic/claude-sonnet-4-6"
                className="form-input text-sm font-mono"
              />
              <datalist id="conduit-models">
                {CONDUIT_MODELS.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
          ) : (
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-sonnet-4-6' : ''}
              className="form-input text-sm font-mono"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Base URL <span className="normal-case font-normal">(leave blank for default)</span>
          </label>
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder={defaultBaseUrls[provider] || ''}
            className="form-input text-sm font-mono"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Custom System Prompt <span className="normal-case font-normal">(optional)</span></label>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={3}
          placeholder="Leave blank to use the default HBZ assistant prompt..."
          className="form-input text-sm resize-none"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save AI Settings'}
        </button>
        {saved && <span className="text-xs text-success">Settings saved successfully</span>}
      </div>
    </div>
  )
}

interface SettingRowProps {
  setting: Setting
}

function SettingRow({ setting }: SettingRowProps) {
  const [value, setValue] = useState(setting.value)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/settings/${setting.key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Save failed')
      }
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setValue(setting.value)
    setEditing(false)
    setError(null)
  }

  return (
    <tr>
      <td className="w-48">
        <code className="text-xs font-mono text-accent">{setting.key}</code>
      </td>
      <td>
        {editing ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="form-input text-sm py-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
        ) : (
          <span className="text-sm text-text-secondary">{value || '—'}</span>
        )}
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </td>
      <td className="text-xs whitespace-nowrap">{formatDateTime(setting.updatedAt)}</td>
      <td>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="text-xs font-medium text-success hover:text-success/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Edit
            </button>
            {saved && <span className="text-xs text-success">Saved</span>}
          </div>
        )}
      </td>
    </tr>
  )
}

interface SettingsClientProps {
  settings: Setting[]
}

export function SettingsClient({ settings }: SettingsClientProps) {
  if (settings.length === 0) {
    return (
      <EmptyState
        title="No settings configured"
        description="Application settings will appear here."
        icon={
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <AiProviderSection settings={settings} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-text-primary">All Settings</h3>
          <p className="text-xs text-text-muted mt-0.5">Raw key-value configuration store</p>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((setting) => (
              <SettingRow key={setting.id} setting={setting} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
