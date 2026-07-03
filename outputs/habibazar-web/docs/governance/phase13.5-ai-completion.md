# Phase 13.5 — AI Platform Completion (increment)

_Same honesty rule as Phases 10–13. This pass completes the single highest-value
deferred AI capability — **automatic CMS → Knowledge-Base synchronization** — with
verified code + tests, and honestly documents the rest. No fabricated 150/150._

## Why CMS→KB sync first

It was the top item on the Phase-13 roadmap and the one with real leverage: it
makes the existing keyword-RAG retrieve **current** content automatically, and it
reuses the Phase-12 debounced data-change hook — so it integrates with the
architecture instead of bolting on a new subsystem. It also delivers, in one
mechanism, several spec bullets: knowledge sync, duplicate detection, orphan
cleanup, and sync logging.

## Shipped this pass

`src/lib/ai/sync.ts`:
- `syncKnowledgeFromCms()` — upserts published content (blog, projects, solutions,
  technologies, professional journey) into `ai_knowledge_base`.
- Stable key `source_url = cms://<type>/<id>` ⇒ **idempotent** (re-run updates, never
  duplicates), **orphan cleanup** (unpublished/deleted → removed), **duplicate
  detection** (one row per source).
- Defensive raw-SQL column access (tolerates schema drift, never throws); HTML
  stripped + length-capped so one row can't dominate retrieval.
- `buildEntry()` is a **pure, unit-tested** row→entry mapping.
- Emits a `logBus` sync event (source `ai`, service `kb-sync`) → visible in
  Logs & Monitoring.
- `scheduleKbSync(resource)` — debounced auto-trigger wired into
  `audit.logAction`: any edit to a synced content table refreshes the KB ~5s later,
  off the request path.
- `POST /api/admin/ai-kb/sync` — manual trigger (gated), returns
  `{created,updated,removed,total,errors}`.

### Verified live (seeded DB)
| Step | Result |
| --- | --- |
| First sync | **created 45**, 0 errors — from blog/projects/solutions/tech/journey |
| Idempotency (re-run) | **0 created, 45 updated** — stable keys, no duplicates |
| Keys | real `cms://blog/1`, `cms://project/1`, … |
| Unit tests | `sync.test.ts` 5/5 (stable key, determinism, FA fallback, null-skip, HTML strip + cap) |

Covers the spec's **CMS Knowledge Synchronization** (auto chunks/refresh/log/retry-
safe) plus KB **duplicate detection** and **orphan cleanup**.

## Already satisfied by prior phases (not duplicated)
Multi-provider abstraction, RAG with citations, KB/prompt/conversation admin,
search, resilience (Phase 13 audit); **AI security** — zod + rate-limit + prompt-
injection defense on the chat endpoint (Phase 13); AI health in the Operations
Center (Phase 12).

## Honest roadmap — NOT delivered this pass
- **Vector embeddings + semantic RAG** (index/rebuild/health/cleanup): current
  retrieval is keyword+priority, which needs no embedding provider; true vectors
  need an embeddings model + vector store (`sqlite-vec`) — a scalability decision.
- **Prompt Center** (versioning/approval/rollback/compare/clone).
- **AI Analytics + Cost dashboards** (tokens, estimated cost, hit/miss, forecast):
  requires capturing token usage from provider responses first.
- **Feedback learning** (thumbs up/down → knowledge-gap detection), **AI Quality
  Engine** (hallucination/citation scoring), **AI Playground**, **model benchmark**.

Each is a real, sizeable effort; stubbing them to claim "150/150" would be
dishonest. The sync mechanism shipped here is a foundation several of them build on
(e.g. a token-usage column feeds analytics; feedback rows feed gap detection).

## Validation after this pass
`tsc` 0 · ESLint 0 · vitest **37/37** (incl. 7 AI-guard + 5 KB-sync) · design-token
audit 0 violations · production build OK · CMS→KB sync verified live (45 created,
idempotent on re-run). Existing chatbot + RAG behavior preserved.
