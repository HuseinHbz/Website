# Phase 22 — AI Platform

The maintainer's vision: the AI Platform is not a side chatbot but the **shared
intelligent core** of HBZ Technology — CMS, CRM, ERP, Backup, Security, Knowledge
Base and Operations all speaking to one AI engine. Six subsystems:

```
AI Platform
├── AI Chat Center      (multi-provider chat + RAG + citations)
├── Knowledge Base      (CMS → KB auto-sync, RAG source)
├── AI Agents           (role-scoped assistants)
├── AI Automation       (event-driven AI actions)
├── AI Analytics        (tokens/cost/latency/success, feedback)
└── Prompt Center       (versioned prompts, approval, rollback)
```

## Honest scope — one real, verified foundation this pass

Per the project's "real, non-fabricated increments" rule, Phase 22 ships **the
shared engine + the AI Agents subsystem end-to-end**, links the public AI
Assistant into the site, and documents the other five subsystems as a concrete
roadmap. Nothing is faked.

## Shipped & verified

### 1. Shared AI engine (`src/lib/ai/engine.ts`)
The provider dispatch (ChatGPT / Claude / Gemini / Grok / Copilot / Conduit),
settings loading, RAG retrieval and the circuit-breaker + retry wrapper were
**extracted out of the public chat route** into one reusable module:
`runCompletion({ messages, systemPrompt, useRag })`. This is literally the "one
shared brain" the vision calls for — chat and agents (and future subsystems) now
run the exact same execution path, no duplicated provider code.
- The public chat route (`/api/ai/chat`) was refactored onto it; behavior
  preserved (guard, rate-limit, module/custom/default prompt, RAG, citations).

### 2. AI Agents (subsystem 3)
- **Registry** (`src/lib/ai/agents.ts`, pure, unit-tested — 6 tests): 10
  role-scoped agents — Content, SEO, Sales, CRM, ERP, Security, Infrastructure,
  Backup, Marketing, HR — each a curated bilingual persona + examples, all
  carrying an anti-fabrication guardrail ("never invent facts/numbers/logs").
  `listAgents` / `getAgent` / `buildAgentRun` are pure.
- **API** (`/api/admin/ai/agents`): GET catalog (secrets stripped) + POST run,
  RBAC-gated (`requireAdmin('edit')`), zod-validated, audit-logged, runs through
  the shared engine (RAG on where the agent benefits).
- **UI** (`/admin/ai-agents`, `AiAgentsManager`, bilingual): agent gallery →
  pick an agent → seed with example tasks → run → response with KB citations.
  Sidebar: new "AI Agents" entry under the AI Platform group.

### 3. Public AI Assistant surfaced
The full public AI page (`/[locale]/ai`) already existed but was unreachable —
now linked in the main site nav (`NAV_ITEMS`) as "AI Assistant / دستیار هوشمند"
so visitors can find it.

**Verified:** tsc 0 · ESLint 0 · vitest (agents 6 + existing) green · 6
governance audits pass (incl. links: `/ai` resolves, i18n: 0 missing) · build OK.

## Roadmap (documented, not yet built)

Real, planned extensions — listed so scope is transparent, not implied as done.
Each composes on the shared engine + the workflow engine's handler seam, so
there is one execution path, no duplication.

- **AI Chat Center upgrades**: conversation history/folders/search (the
  `ai_conversations` table + `/api/ai/conversations` exist as the seam),
  multi-model side-by-side compare, export/share, voice/image/file upload.
- **AI Agents v2 — tool handlers**: give agents typed, read-only tools to pull
  **live** CRM/ERP/Security/Backup telemetry (through the same handler seam the
  workflow engine uses) so answers are grounded in real module data, not only
  the KB. This is what powers "این ماه سود چقدر بوده؟" / "کدام مشتری آماده خرید
  است؟" / "چه بکاپ‌هایی fail شده‌اند؟".
- **AI Automation Center**: event-driven AI actions (article published → auto
  translate → SEO → meta/schema/OG → KB sync → social schedule) built as
  workflow task handlers that call agents — the workflow engine already exists.
- **Prompt Center**: versioned prompts with approval/rollback/history/owner/test
  and variables; agents and modules resolve their system prompt from it.
- **AI Analytics**: per-run tokens/cost/latency/success/failure by provider &
  model, cache/RAG-hit/citation stats, top prompt/agent, thumbs-up/down feedback
  (`ai-analytics` API exists as the seam), daily/weekly/monthly charts.
- **Embeddings + vector search** for RAG (currently keyword scoring over the KB).
- **AI Executive Summary** card on the dashboard + per-module "✨ Ask AI" buttons
  (each just calls the shared engine with a context-scoped prompt).
