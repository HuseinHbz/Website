# Habibazar AI Assistant — Documentation

## Overview

The Habibazar AI Assistant is a streaming SSE-based conversational interface that helps website visitors understand consulting services and routes qualified leads into the pipeline.

## Provider Configuration

Set `AI_PROVIDER` in `.env` to select the backend:

| Provider | `AI_PROVIDER` | Required Key |
|----------|---------------|--------------|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| Ollama (local) | `ollama` | none (set `OLLAMA_BASE_URL`) |

### Model selection

```env
# OpenAI
OPENAI_MODEL=gpt-4o-mini

# Anthropic
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
ANTHROPIC_VERSION=2023-06-01

# DeepSeek
DEEPSEEK_MODEL=deepseek-chat

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

### Tuning parameters

```env
AI_MAX_TOKENS=800        # Max tokens per response
AI_TEMPERATURE=0.4       # 0=deterministic, 1=creative
AI_HISTORY_LIMIT=12      # Messages kept in context window
AI_MAX_TURNS=25          # Max turns per conversation
AI_TIMEOUT_MS=60000      # Provider timeout (ms)
```

---

## Intake Flow

### Step 1: Start Conversation

```http
POST /api/v1/ai/conversations
Content-Type: application/json

{
  "sessionRef": "visitor-uuid-or-fingerprint",
  "locale": "FA",
  "name": "Ali",           // optional at start
  "company": "TechCorp",   // optional
  "phone": "+98123456789"  // optional
}
```

Response:
```json
{
  "data": {
    "id": "conv-uuid",
    "locale": "FA",
    "turnCount": 0,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Step 2: Send Message (SSE Streaming)

```http
POST /api/v1/ai/conversations/{id}/messages
Content-Type: application/json

{
  "message": "سلام، می‌خواهم درباره زیرساخت ابری بدانم",
  "locale": "FA"
}
```

Response: `text/event-stream`

```
data: {"type":"delta","content":"سلام! "}

data: {"type":"delta","content":"خوش آمدید..."}

data: {"type":"done"}
```

On error:
```
data: {"type":"error","message":"Turn limit exceeded"}
```

### Frontend JavaScript example

```javascript
const response = await fetch('/api/v1/ai/conversations/CONV_ID/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput, locale: 'FA' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n').filter(l => l.startsWith('data: '));

  for (const line of lines) {
    const event = JSON.parse(line.slice(6));
    if (event.type === 'delta') appendToChat(event.content);
    if (event.type === 'done') finishStream();
    if (event.type === 'error') showError(event.message);
  }
}
```

---

## Lead Creation

The assistant creates leads automatically:

1. **At conversation start** — if `name` + `phone` provided in intake
2. **During conversation** — when the user provides phone number in chat

Lead source is always `AI_ASSISTANT`.

Initial scoring:
- +15 if company provided
- +5 base score

For full lead qualification, the visitor is guided toward a consultation booking.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST `/ai/conversations` | 30/min (public) + 10/min (AI) |
| POST `/ai/conversations/:id/messages` | 30/min (public) + 10/min (AI) |

Limits are per-IP, in-memory. For production clusters, configure Redis-backed rate limiting.

---

## Data Retention

Conversations are retained for `AI_RETENTION_DAYS` (default: 180 days).

The cleanup job removes old conversations:
```bash
npm run db:cleanup
```

Schedule with cron:
```bash
0 3 * * 0 cd /opt/habibazar-api && npm run db:cleanup
```

---

## Turn Limits

Each conversation has a maximum of `AI_MAX_TURNS` turns (default: 25).

When reached, the API returns:
```json
data: {"type":"error","message":"Maximum conversation turns (25) reached. Please start a new conversation."}
```

The frontend should detect this and prompt the user to start fresh.

---

## Topic Categories

The assistant classifies conversations into:

| Category | Description |
|----------|-------------|
| `INFRASTRUCTURE` | Server infrastructure, data center, on-premise |
| `CLOUD` | Cloud services, migration, hybrid cloud |
| `SECURITY` | Cybersecurity, risk assessment, compliance |
| `NETWORKING` | Networking, SD-WAN, VPN, routing |
| `CONSULTING` | General consulting, strategy |
| `GENERAL` | Unclassified questions |

Category is stored on the `Conversation` record and visible in the admin AI analytics dashboard.

---

## Integrity Constraints

The system prompt enforces strict integrity rules that cannot be overridden:

1. **No fabricated statistics** — never cite metrics without verified sources
2. **No fake client names** — never claim specific clients without authorization
3. **No imaginary certifications** — only verified credentials
4. **Flag unverified claims** — if a visitor asserts something, mark it as unverified
5. **Consultation redirect** — for specific numbers/guarantees, redirect to direct consultation

These constraints are enforced at the prompt level and cannot be disabled via API.

---

## Admin Access

View conversations via admin API:

```http
GET /api/v1/admin/ai/conversations?page=1&limit=20&locale=FA
Authorization: Bearer {admin-token}
```

Analytics:
```http
GET /api/v1/admin/ai/analytics
Authorization: Bearer {admin-token}
```

Delete a conversation (requires `ai:write` permission):
```http
DELETE /api/v1/admin/ai/conversations/{id}
Authorization: Bearer {admin-token}
```
