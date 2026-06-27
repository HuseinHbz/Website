import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Conversation, Message } from '@/lib/types'

interface ConversationViewProps {
  conversation: Conversation & { messages: Message[] }
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'USER'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'bg-surface2 text-text-primary border border-border rounded-tl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isUser ? 'text-white/60' : 'text-text-muted'
          }`}
        >
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}

export function ConversationView({ conversation }: ConversationViewProps) {
  const messages = conversation.messages || []

  return (
    <div className="space-y-6">
      {/* Metadata card */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Conversation Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-muted">Name</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">
              {conversation.name || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Company</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">
              {conversation.company || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Phone</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">
              {conversation.phone || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Category</p>
            <div className="mt-0.5">
              {conversation.category ? (
                <Badge variant="info">{conversation.category}</Badge>
              ) : (
                <span className="text-sm text-text-muted">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted">Locale</p>
            <p className="text-sm font-mono text-text-primary mt-0.5">{conversation.locale}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Turns</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">
              {conversation.turnCount}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">
            Messages ({messages.length})
          </h2>
        </div>

        {messages.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">
            No messages in this conversation.
          </div>
        ) : (
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
