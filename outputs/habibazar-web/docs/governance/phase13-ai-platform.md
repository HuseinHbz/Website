# Phase 13 — Enterprise AI Platform

_Same honesty rule as Phases 10–12. The AI subsystem is already substantial, so
this pass follows the phase's own "extend, don't duplicate, don't break the
chatbot" rule: it closes the biggest real gap (AI security on the public endpoint)
with verified code + tests, and honestly maps what already exists vs. what remains
a roadmap. No fabricated 120/120._

## AI audit — what already exists (do NOT rebuild)

| Spec section | Existing implementation |
| --- | --- |
| Multi-Model Platform (OpenAI, Anthropic, Gemini, Grok, Conduit; provider swap without code change via `ai_provider` setting) | `src/app/api/ai/chat/route.ts` — real provider abstraction |
| RAG Engine (retrieval over knowledge base, source ranking, citations `[1][2]`) | `retrieveContext()` in the chat route + `ai_knowledge_base` table |
| Knowledge Base admin | `/admin/ai-kb` + `/api/admin/ai-kb` |
| Prompt / module management | `/admin/ai-control`, `ai_modules` table, per-module system prompts |
| Conversation storage | `ai_conversations` table + `/api/ai/conversations` |
| Search | `/api/ai/search` + public `/api/search` |
| AI Analytics | `/api/admin/ai-analytics` |
| Resilience (circuit breaker + retry + fallback) | `lib/circuitBreaker.ts`, `lib/retry.ts` |
| AI health surfacing | Operations Center subsystem matrix (Phase 12) |

## Shipped this pass — AI Security layer (the real gap)

The public `POST /api/ai/chat` had **no input validation, no rate limiting, and no
prompt-injection defense** — it embedded raw user text into the system prompt
beside retrieved KB context. Closed with `src/lib/ai/guard.ts` + wiring:

- **Input validation (zod)** with caps (message length, message count). Crucially,
  the client may only send `user`/`assistant` roles — a client-supplied `system`
  role is **rejected (400)** so it cannot smuggle its own system prompt.
- **Rate limiting**: 20 req/min per IP (`limiters.ai`) → 429 with `Retry-After`.
- **Prompt-injection / jailbreak / exfiltration detection**: deterministic pattern
  scan (instruction override, "developer mode / DAN", system-prompt or secret
  exfiltration, role injection, RAG context-delimiter injection). High-risk →
  blocked with a safe bilingual refusal + a `logger.security` audit entry
  (source `ai`). Low-risk → allowed but flagged.
- **RAG delimiter sanitization**: `--- END CONTEXT ---`-style markers in user text
  are neutralized before the prompt is assembled, so users can't break framing.
- **Tuned for zero false positives** on legitimate IT/infra questions (MikroTik
  VPN, VMware HA, Cisco hardening, QoS "ignore thresholds", …).

### Verified — unit + live
- `src/lib/ai/__tests__/guard.test.ts`: 7 tests (blocks 6 injection classes +
  delimiter + exfiltration; allows 5 legit IT questions; role-scoping; sanitize).
- Live against the running endpoint:
  - injection → `{ blocked: true }` + bilingual refusal (before any model call)
  - client `system` role → **400**
  - legit question → **503** ("AI key not configured" — i.e. passed the guard, not blocked)
  - audit row written: `warn · ai · [SECURITY] AI prompt-injection blocked`

Covers the spec's **AI Security** (Prompt Injection, Jailbreak, Data Leakage,
Sensitive Info Exposure, Abuse Detection, Rate Limiting, Audit Logging) and the
**Security Tests** part of the Testing section.

## Honest roadmap — NOT delivered this pass

Real, sizeable pieces; each deserves a focused effort rather than a stub:

- **Vector/semantic RAG + embeddings** (index, rebuild, health, incremental,
  cleanup): today's retrieval is keyword+priority scoring, which works without an
  embedding provider. True vectors need an embeddings model + a vector store
  (or `sqlite-vec`) — a scalability-track decision.
- **Prompt Center** (templates, versioning, approval, rollback, A/B compare) and
  **Conversation insights / ratings / session replay** beyond current storage.
- **AI Analytics dashboard** (tokens, estimated cost, hit/miss, satisfaction) —
  `/api/admin/ai-analytics` exists; a full dashboard + token/cost capture does not.
- **Feedback learning** (thumbs up/down → knowledge-gap detection).
- **Content synchronization** (auto-sync CMS → KB on change): the Phase-12 debounced
  data-change hook is a natural trigger to build on.
- **AI Quality Engine** (hallucination/citation scoring), OpenRouter/local-model
  adapters, and the full AI Center admin dashboard.

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **32/32** (incl. 7 AI-guard) · design-token/content
audits 0 violations · production build OK · guard verified live on the real
endpoint. Existing chatbot behavior preserved (legit questions pass through).
