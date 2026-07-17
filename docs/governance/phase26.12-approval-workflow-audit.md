# Phase 26.12 — Approval & Workflow Intelligence: Audit (AUDIT FIRST)

Code-verified audit before building. **NO DUPLICATE WORKFLOW ENGINE / NO FAKE.**
Everything ✅ is reused; only ❌ gaps are built.

## Existing (reuse)
| Capability | Where | Verdict |
|---|---|---|
| Graph workflow engine | `lib/workflow/engine.ts` (`executeWorkflow`, nodes start/end/set/condition/log/task/delay/approval; `approval` pauses→waiting), `WorkflowCanvas`, `workflows`/`workflow_runs` | ✅ reuse (extend node types) |
| Business Rules Engine | `lib/rules/engine.ts` (`ruleMatches`/`evalCondition`/`runRules`), `business_rules`, `ruleData.runRuleByKey` | ✅ reuse (routing + policies) |
| Multi-level approval foundation | `lib/erp/purchasing.ts` `ApprovalTier`/`requiredApprovalLevels`/`isFullyApproved`, `purchase_approvals` | ✅ generalize |
| Notifications | `lib/notifications.ts` (`sendMail`/`notify`), Integration Hub webhooks | ✅ reuse (M12) |
| Audit trail | `logAction(user,action,resource,id,old,new,ip)` | ✅ reuse (M13) |
| RBAC | `canDo` + `finance_role` + `erp_cost_center_members` (26.11) | ✅ reuse (M13) |
| AI | `runCompletion` + RAG + `financeAi` pattern | ✅ reuse (M10) |

## Gaps to build (❌)
Centralized **matrix-driven** approval orchestration (distinct from, and
integrated with, the graph engine — NOT a second executor): approval matrix
engine (M1), dynamic routing via rules (M2), parallel approval (M4), delegation
(M5), SLA escalation (M6 — the honest boundary left open in 26.9, now built),
approval inbox (M8), comments (M9), AI approval assistant (M10), analytics (M11),
notification wiring (M12), tables (M14), ERP integration hook (M15), tests (M16).
Designer node types parallel/notification/ai_decision added additively (M3).

## Design (no duplicate)
The approval platform is a matrix/step store (`approval_requests` +
`approval_actions` + `approval_matrix` + `approval_delegations` +
`workflow_escalations` + `workflow_comments` + `workflow_notifications`) with
pure engines. The graph engine's `approval` node can create an approval_request;
the graph executor is NOT duplicated. ERP modules call one generic
`requestApproval(...)` hook.
