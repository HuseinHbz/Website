/**
 * Unified messaging provider abstraction (Phase 26.25s بند ۴.۱) — the same shape
 * as the 26.24 payment GatewayProvider, generalised across four channels
 * (sms · email · whatsapp · telegram). Each concrete provider lives in its own
 * file and implements this contract. With NO credential the manager falls back
 * to a DETERMINISTIC sandbox (never silently drops) → labelled blocked-external.
 */

export type Channel = 'sms' | 'email' | 'whatsapp' | 'telegram'

export interface MessageConfig {
  apiKey?: string
  sender?: string
  phoneNumberId?: string   // WhatsApp Cloud
  token?: string           // WhatsApp Cloud
  botToken?: string        // Telegram
}

export interface OutboundMessage {
  to: string                         // phone | email | wa number | telegram chat_id
  text: string
  subject?: string                   // email
  html?: string                      // email
  /** WhatsApp: send an approved template instead of free-form (outside 24h). */
  template?: { name: string; language: string; params?: string[] }
}

export interface SendResult {
  ok: boolean
  messageId?: string
  error?: string
  sandbox?: boolean
  rejected?: boolean
}

export interface ProviderCapabilities {
  channel: Channel
  supportsTemplates: boolean
  supportsDelivery: boolean
  requiresChatId: boolean
}

export interface MessageProvider {
  id: string
  channel: Channel
  capabilities(): ProviderCapabilities
  verifyConfig(cfg: MessageConfig): boolean
  send(msg: OutboundMessage, cfg: MessageConfig): Promise<SendResult>
}
