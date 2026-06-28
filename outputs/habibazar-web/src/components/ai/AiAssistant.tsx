'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { focusRing } from '@/lib/a11y'
import { SITE } from '@/lib/site'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'closed' | 'intake' | 'chat'

interface IntakeData {
  name: string
  company: string
  phone: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AiAssistantProps {
  locale: string
}

const MAX_TURNS = 10

// ─── Markdown renderer (minimal) ─────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bold: **text** or __text__
    const withBold = line
      .split(/(\*\*[^*]+\*\*|__[^_]+__)/)
      .map((part, j) => {
        if (/^(\*\*|__)/.test(part)) {
          const inner = part.slice(2, -2)
          return <strong key={j} className="font-semibold text-text-primary">{inner}</strong>
        }
        return part
      })

    if (line.trim() === '') {
      result.push(<br key={i} />)
    } else {
      result.push(
        <span key={i} className="block leading-relaxed">
          {withBold}
        </span>
      )
    }
  }

  return result
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChatBubbleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AiAssistant({ locale }: AiAssistantProps) {
  const t = useTranslations('ai')
  const ta = useTranslations('a11y')
  const isRTL = locale === 'fa'

  const [phase, setPhase] = useState<Phase>('closed')
  const [intake, setIntake] = useState<IntakeData>({ name: '', company: '', phone: '' })
  const [intakeErrors, setIntakeErrors] = useState<Partial<IntakeData>>({})
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatLocale, setChatLocale] = useState(locale)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Listen for external open event (from AiTeaser)
  useEffect(() => {
    function handleOpen() {
      if (phase === 'closed') {
        setPhase('intake')
      }
    }
    window.addEventListener('open-ai-assistant', handleOpen)
    return () => window.removeEventListener('open-ai-assistant', handleOpen)
  }, [phase])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus chat input when entering chat phase
  useEffect(() => {
    if (phase === 'chat') {
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }, [phase])

  // ── Intake validation ────────────────────────────────────────────────────

  function validateIntake(): boolean {
    const errors: Partial<IntakeData> = {}
    if (!intake.name.trim()) {
      errors.name = isRTL ? 'نام الزامی است' : 'Name is required'
    }
    if (!intake.phone.trim()) {
      errors.phone = t('intake.phoneRequired')
    } else if (!/^[+\d\s\-()]{7,}$/.test(intake.phone.trim())) {
      errors.phone = isRTL ? 'شماره تلفن معتبر نیست' : 'Invalid phone number'
    }
    setIntakeErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Intake submit ────────────────────────────────────────────────────────

  async function handleIntakeSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validateIntake()) return

    setIsSubmittingIntake(true)
    setError(null)

    try {
      const res = await fetch(`${SITE.apiUrl}/api/v1/ai/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: intake.name.trim(),
          company: intake.company.trim() || undefined,
          phone: intake.phone.trim(),
          locale: chatLocale,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json() as { id: string; greeting?: string }
      setConversationId(data.id)

      // Add greeting if provided
      if (data.greeting) {
        setMessages([
          {
            id: 'greeting',
            role: 'assistant',
            content: data.greeting,
            timestamp: new Date(),
          },
        ])
      }

      setPhase('chat')
    } catch {
      setError(t('error'))
    } finally {
      setIsSubmittingIntake(false)
    }
  }

  // ── Send message with SSE streaming ─────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim()
    if (!content || !conversationId || isStreaming) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsStreaming(true)
    setError(null)

    const assistantMsgId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    ])

    try {
      const res = await fetch(
        `${SITE.apiUrl}/api/v1/ai/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ content, locale: chatLocale }),
        }
      )

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue

          try {
            const event = JSON.parse(raw) as {
              type: string
              content?: string
            }
            if (event.type === 'delta' && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              )
            }
          } catch {
            // Ignore JSON parse errors on malformed SSE events
          }
        }
      }
    } catch {
      setError(t('error'))
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
    } finally {
      setIsStreaming(false)
    }
  }, [inputValue, conversationId, isStreaming, chatLocale, t])

  // Handle Enter key in chat input
  function handleChatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const turnCount = messages.filter((m) => m.role === 'user').length
  const isAtLimit = turnCount >= MAX_TURNS

  // ── Position ─────────────────────────────────────────────────────────────
  // RTL: bottom-left / LTR: bottom-right

  const floatPosition = isRTL
    ? 'bottom-6 start-6'
    : 'bottom-6 end-6'

  // ── Render ───────────────────────────────────────────────────────────────

  if (phase === 'closed') {
    return (
      <div className={cn('fixed z-50', floatPosition)}>
        <button
          type="button"
          onClick={() => setPhase('intake')}
          aria-label={ta('openChat')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-full',
            'bg-accent hover:bg-accent-hover text-white',
            'shadow-lg shadow-accent/30',
            'transition-all duration-200 hover:scale-105',
            'animate-pulse-glow',
            focusRing
          )}
        >
          <ChatBubbleIcon />
          <span className="text-sm font-medium hidden sm:inline">{t('button')}</span>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setPhase('closed')}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col',
          'w-full sm:w-[400px] max-h-[85vh]',
          'bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50',
          isRTL ? 'bottom-6 start-6' : 'bottom-6 end-6'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0" dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              'bg-accent/10 text-accent'
            )}>
              <ChatBubbleIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{t('title')}</p>
              {phase === 'chat' && (
                <p className="text-xs text-text-muted">{t('subtitle')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Locale toggle */}
            <button
              type="button"
              onClick={() => setChatLocale((l) => l === 'fa' ? 'en' : 'fa')}
              className={cn(
                'text-xs px-2 py-1 rounded border border-border',
                'text-text-muted hover:text-text-primary hover:border-accent/40',
                'transition-colors',
                focusRing
              )}
              aria-label={ta('langSwitch')}
            >
              {chatLocale === 'fa' ? 'EN' : 'FA'}
            </button>
            <button
              type="button"
              onClick={() => setPhase('closed')}
              aria-label={ta('closeChat')}
              className={cn(
                'p-1.5 rounded-md text-text-muted hover:text-text-primary',
                'hover:bg-white/5 transition-colors',
                focusRing
              )}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Intake form */}
        {phase === 'intake' && (
          <div className="flex-1 overflow-y-auto p-5" dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}>
            <p className="text-sm font-semibold text-text-primary mb-1">
              {t('intake.title')}
            </p>
            <p className="text-xs text-text-secondary mb-5">
              {t('intake.description')}
            </p>

            <form onSubmit={handleIntakeSubmit} noValidate className="flex flex-col gap-4">
              <Input
                label={t('intake.name')}
                placeholder={t('intake.namePlaceholder')}
                value={intake.name}
                onChange={(e) => setIntake((v) => ({ ...v, name: e.target.value }))}
                error={intakeErrors.name}
                required
                dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}
              />

              <Input
                label={`${t('intake.company')} (${chatLocale === 'fa' ? 'اختیاری' : 'Optional'})`}
                placeholder={t('intake.companyPlaceholder')}
                value={intake.company}
                onChange={(e) => setIntake((v) => ({ ...v, company: e.target.value }))}
                dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}
              />

              <Input
                label={t('intake.phone')}
                placeholder={t('intake.phonePlaceholder')}
                type="tel"
                value={intake.phone}
                onChange={(e) => setIntake((v) => ({ ...v, phone: e.target.value }))}
                error={intakeErrors.phone}
                required
                dir="ltr"
              />

              {error && (
                <p role="alert" className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                loading={isSubmittingIntake}
              >
                {t('intake.submit')}
              </Button>
            </form>
          </div>
        )}

        {/* Chat */}
        {phase === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-text-muted text-center">
                    {chatLocale === 'fa' ? 'سوال خود را بپرسید...' : 'Ask your question...'}
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] px-4 py-3 rounded-2xl text-sm',
                      msg.role === 'user'
                        ? 'bg-accent text-white rounded-ee-sm'
                        : 'bg-background border border-border text-text-secondary rounded-es-sm'
                    )}
                    dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}
                  >
                    {msg.role === 'assistant' && msg.content === '' ? (
                      <span className="flex items-center gap-1.5">
                        <LoadingSpinner size="sm" />
                        <span className="text-xs">{t('chat.thinking')}</span>
                      </span>
                    ) : (
                      renderMarkdown(msg.content)
                    )}
                  </div>
                </div>
              ))}

              {/* Turn limit warning */}
              {isAtLimit && (
                <div className="rounded-xl p-4 bg-warning/10 border border-warning/20 text-center">
                  <p className="text-xs text-warning mb-3">{t('turnLimit')}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      window.location.href =
                        `/${locale}/consultation`
                    }}
                  >
                    {t('bookConsultation')}
                  </Button>
                </div>
              )}

              {error && (
                <p role="alert" className="text-xs text-red-400 text-center py-2">
                  {error}
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              {turnCount > 0 && (
                <p className="text-xs text-text-muted mb-2 text-end">
                  {turnCount}/{MAX_TURNS}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={t('chat.placeholder')}
                  disabled={isStreaming || isAtLimit}
                  dir={chatLocale === 'fa' ? 'rtl' : 'ltr'}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm rounded-xl',
                    'bg-background border border-border',
                    'text-text-primary placeholder:text-text-muted',
                    'focus:border-accent focus:outline-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                  aria-label={t('chat.placeholder')}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isStreaming || isAtLimit}
                  aria-label={t('chat.send')}
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                    'bg-accent hover:bg-accent-hover text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors',
                    focusRing
                  )}
                >
                  {isStreaming ? <LoadingSpinner size="sm" /> : <SendIcon />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
