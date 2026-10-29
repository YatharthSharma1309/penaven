# Penaven product structure

Canonical map of shells, lanes, routes, and APIs as of the UI polish pass (Aug 2026).

## Shells

| Shell | Entry | Chrome |
|-------|-------|--------|
| Marketing | `/` | `MarketingHeader` + `SiteFooter` |
| Dashboard | `/(dashboard)/*` | `DashboardShell` → top bar + mobile drawer |
| Embed | `/widget/embed` | Floating widget only (no app chrome) |

## Agent lanes

```
Support lane:  widget / chat → RAG → escalate → ticket triage → execution run
Hiring lane:   job → resume upload → match score → scorecard / compare
```

Both lanes share org knowledge (`Document` / chunks) and the same workspace nav.

## Demo click path

1. `/` — Penaven brand + **Open live demo**
2. `/dashboard` — next-step banner → widget / execution runs
3. `/widget` — ask FAQ → escalate
4. `/widget/intake` → `/widget/intake/[runId]` — storyboard
5. `/tickets/[id]` — operator brief
6. Optional `/recruitment` → compare / scorecard

Top bar: **Inbox** · **Tickets** · **Knowledge** · **Widget** · **Hiring**. Secondary: **Home** · **Boards** · **Run log** · **Chat** · **Settings** (`src/components/layout/app-nav.ts`).

## Route map

### Public
| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/help`, `/help/[slug]` | Public knowledge |
| `/widget/embed` | Customer bubble |
| `/sign-in`, `/sign-up` | Clerk (demo mode redirects to dashboard) |
| `/onboarding` | First-run |

### Dashboard
| Route | Purpose |
|-------|---------|
| `/dashboard` | Command center |
| `/widget`, `/widget/intake`, `/widget/intake/[runId]` | Widget preview + execution audit |
| `/chat`, `/inbox`, `/inbox/[id]` | Admin chat + agent inbox |
| `/tickets`, `/tickets/new`, `/tickets/[id]` | Tickets + triage |
| `/knowledge`, `/analytics`, `/settings` | KB, gaps, agent settings |
| `/recruitment`, `/recruitment/jobs/*` | Hiring lane (`/hiring` in public demo mode) |

## API map (by domain)

| Domain | Routes |
|--------|--------|
| Chat | `POST /api/chat`, `/api/chat/stream`; `GET /api/conversations`, `/api/conversations/[id]`; feedback on messages |
| Widget | `POST /api/widget/session`, `/api/widget/chat/stream`, `/api/widget/tickets`, widget feedback |
| Tickets | `GET/POST /api/tickets`; `GET/PATCH /api/tickets/[id]`; comments; suggest-reply |
| Knowledge | documents upload/list/delete; `POST /api/knowledge/draft-faq`, `publish-faq` |
| Recruitment | jobs CRUD, assist, hire finalize/undo; candidates; upload; analyze |
| Settings / demo | `/api/settings`, `/api/settings/widget`, `POST /api/demo/seed` |
| Health | `GET /api/health` (public) |
| Webhooks | `POST /api/webhooks/clerk` |

## Visual system

| Token | Role |
|-------|------|
| `--primary` (`#312e81`) | Indigo actions, support lane |
| `--accent` (`#0f766e`) | Teal hiring / success accents |
| `--background` / `--surface` | Cool paper + white |
| Brand mark | P on an indigo tile with a teal page corner (`OpsConciergeLogoMark`) |

## Key libs

| Path | Role |
|------|------|
| `src/lib/chat/` | RAG stream, Gemini-first |
| `src/lib/tickets/` | Create ticket + escalation triage |
| `src/lib/recruitment/` | Resume parse, match, scorecard |
| `src/lib/execution/storyboard.ts` | Owner-facing run steps |
| `src/lib/ops-worker.ts` | Firebase RTDB evidence |
| `src/lib/auth/` | Clerk + public demo bypass |

## Related docs

- [FOUNDATION.md](./FOUNDATION.md) — stack + modules
- [ARCHITECTURE.md](./ARCHITECTURE.md) — request paths
- [PROJECTS.md](./PROJECTS.md) — Neon / Vercel isolation
