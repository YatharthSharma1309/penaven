# Penaven

**The support desk for a small team.** Customers get answers from the documents you already have, with the passage named. When those documents do not cover a question, a person gets the conversation. When a role opens, the shortlist stays in the same workspace.

| | |
|---|---|
| **Live site** | https://penaven.vercel.app (public demo, no sign-in) |
| **Repo** | https://github.com/YatharthSharma1309/penaven |
| **Health check** | `GET /api/health` (checks Postgres) |

> The wordmark on the screens is **Penaven**. The npm package is still named `opsconcierge`, and some log lines still print `[OpsConcierge]`.

---

## Contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Routes](#routes)
- [Deploying](#deploying)
- [Docs](#docs)

---

## What it does

The workspace has two lanes. Support is the desk you use every week. Hiring sits in the same workspace for the weeks a role is open.

### Support

1. **Upload the docs.** A FAQ, refund policy, or hours page (`.txt`, `.md`, PDF, or `.docx`, up to 10 MB). On Knowledge, each file is **Reading**, **Ready**, or **Could not read**.
2. **Answer with a citation.** The site chat widget answers from Ready documents and shows the passage it used under the reply.
3. **Hand off to a person.** When the docs do not cover the question, the widget asks for an email and opens a case that keeps the whole conversation.
4. **Fill the gap.** Boards (`/analytics`) lists the questions the docs did not cover and the answers someone marked wrong. **Draft a page**, edit it, and **Add to the docs**.

The run log at `/widget/intake` records what was retrieved for each reply, and whether the answer came from the docs or went to a person.

| Inbox label | Meaning |
|-------------|---------|
| **Open** | A reply is still needed. |
| **Waiting for a human** | A case is already with a person. |
| **Answered** | The docs covered the last reply. This does not mean the case is closed. |

Tickets have their own statuses: Open, In progress, Resolved, Closed.

### Hiring

On a candidate, **Requirement evidence** comes first: each job requirement sits next to the resume line that supports it.

| Mark | Meaning |
|------|---------|
| **Shown** | The resume quotes that requirement. |
| **Inferred** | An indirect reading. |
| **Unverified** | Counted without a quote. |
| **Not shown** | The resume does not establish it. |
| **Contradicts** | The resume states the opposite. |

**Criteria alignment** (a percentage) comes after the evidence. It does not predict job performance and it is not a hiring recommendation. **Questions to ask** are generated from the gaps. A person decides to compare, shortlist, or reject. Nothing is rejected automatically.

A role can **Export CSV** and **Copy shortlist link**. Public samples, with no sign-in: `/demo/hiring`, `/demo/hiring/compare`, `/share/sample`.

### Plans

| Plan | Price | Assistant answers / mo | Resume screens / mo | Open roles |
|------|-------|------------------------|---------------------|------------|
| Free | $0 | 40 | 5 | 1 |
| Pro | $39/mo | 250 | 40 | 5 |

No fee per answer, and no fee when a person takes the thread. Past the cap, the widget still offers a person. Paid checkout is not wired up yet, so every signed-in workspace stays on Free. The public demo skips the caps. The limits are defined in [src/lib/billing/plans.ts](./src/lib/billing/plans.ts).

**Not in this version:** phone or WhatsApp channels, website crawling, live order tracking, auto-reject, or a checkout button.

---

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**, Tailwind CSS 4
- **Prisma 7** on **PostgreSQL** (Neon in production). The client is generated into `src/generated/prisma`
- **Clerk** for auth and organizations, with an optional demo bypass
- **Gemini** and/or **OpenRouter** for chat and RAG
- **Upstash Redis** (optional) for rate limits shared across instances
- **Firebase Realtime Database** (optional) to store evidence from agent runs
- **Vitest** for unit tests, **Playwright** for end-to-end tests
- Deployed on **Vercel**

> **Heads-up for contributors:** Next.js 16 breaks several older APIs and conventions. Before changing framework-level code, read the guides in `node_modules/next/dist/docs/`. The other agent and contributor rules are in [AGENTS.md](./AGENTS.md).

---

## Quick start

Requirements: **Node.js 20+** and npm.

```bash
npm install          # also runs `prisma generate`
```

### 1. Get a database

Pick one:

- **Hosted Postgres (Neon or any other):** copy a connection string that includes `sslmode=require`.
- **Local, no install:** run a Postgres-compatible PGlite server on port 5433. Its data lives in `%LOCALAPPDATA%\penaven-local-db` (or `~/.local/penaven-local-db`).

  ```bash
  npm run db:local     # leave this running in its own terminal
  ```

  Connection string: `postgresql://postgres:postgres@127.0.0.1:5433/postgres`

### 2. Configure the environment

The Prisma CLI loads **`.env`**. Next.js also loads **`.env.local`**. The easiest setup is to put the variables in `.env`. Neither file is committed.

A minimal local setup, with no Clerk and the free LLM path:

```bash
DATABASE_URL=postgresql://...
APP_URL=http://localhost:3000

# Run without Clerk (local / portfolio demo only, never on a real tenant)
AUTH_BYPASS=true
NEXT_PUBLIC_AUTH_BYPASS=true
PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_PUBLIC_DEMO_MODE=true

# Free LLM via OpenRouter: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_CHAT_MODEL=openrouter/free
AI_PROVIDER_PREFERENCE=openrouter
```

To use Gemini instead, see [docs/GCP_AND_GEMINI_SETUP.md](./docs/GCP_AND_GEMINI_SETUP.md). For the no-payment OpenRouter path, see [docs/FREE_LLM.md](./docs/FREE_LLM.md).

### 3. Migrate, seed, run

```bash
npm run db:migrate   # apply migrations
npm run db:seed      # demo workspace with a sample knowledge document
npm run dev
```

Open http://localhost:3000. With the bypass variables set, the dashboard opens without signing in. To give the chat more to cite, upload a few more FAQ documents on **Knowledge**.

---

## Environment variables

| Variable | Needed | Notes |
|----------|--------|-------|
| `DATABASE_URL` | **Yes** | Postgres connection string |
| `APP_URL` | **Yes** | Base URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Prod | Not needed with the demo bypass |
| `CLERK_SECRET_KEY` | Prod | |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Prod | For `/api/webhooks/clerk` (read by Clerk's `verifyWebhook`) |
| `WIDGET_VISITOR_SECRET` | Prod | Signs widget visitor sessions. Production requires it |
| `OPENROUTER_API_KEY` | One LLM key | Required in public-demo mode |
| `OPENROUTER_CHAT_MODEL` | No | Default `openrouter/free` |
| `OPENROUTER_EMBEDDING_MODEL` | No | Embedding model for retrieval |
| `GEMINI_API_KEY` | One LLM key | Pair with `AI_PROVIDER_PREFERENCE=auto` or `gemini` |
| `GEMINI_CHAT_MODEL` | No | e.g. `gemini-3.5-flash` |
| `AI_PROVIDER_PREFERENCE` | No | `openrouter` · `gemini` · `auto` (default: tries Gemini first, then OpenRouter) |
| `DEMO_SEED_SECRET` | Prod demo | Protects `POST /api/demo/seed` |
| `DEMO_WIDGET_KEY` | No | Stable widget key for the demo and e2e tests |
| `AUTH_BYPASS` / `NEXT_PUBLIC_AUTH_BYPASS` | Dev / demo | Skip Clerk. Production refuses to start with these unless `PUBLIC_DEMO_MODE` is on |
| `PUBLIC_DEMO_MODE` / `NEXT_PUBLIC_PUBLIC_DEMO_MODE` | Demo | Public portfolio mode with no plan caps |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | Rate limits shared across instances. Without them, limits are per instance |
| `FIREBASE_DATABASE_URL` | No | Stores evidence from agent runs in RTDB |
| `OPS_WORKER_URL` | No | Optional [Cloud Run worker](./cloud-run/ops-worker/README.md) |

The startup checks are in [src/lib/env/production.ts](./src/lib/env/production.ts). The full production list is in [DEPLOY.md](./DEPLOY.md).

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (webpack) on port 3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint over `src` and `e2e` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (`npm run test:watch` to watch) |
| `npm run test:e2e` | Playwright end-to-end tests (`test:e2e:ui` for the UI runner) |
| `npm run db:local` | Local PGlite Postgres on `127.0.0.1:5433` |
| `npm run db:migrate` | Create and apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (prod / CI) |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:seed` | Seed demo data ([scripts/seed-demo.ts](./scripts/seed-demo.ts)) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |

---

## Testing

```bash
npm run lint && npm run typecheck && npm test
```

The unit tests sit next to the code they cover (`src/**/*.test.ts`).

The end-to-end tests in [e2e/](./e2e) start the dev server with the auth bypass and a test widget key ([playwright.config.ts](./playwright.config.ts)). They need a reachable `DATABASE_URL`. To run them against a deployed URL instead:

```bash
PLAYWRIGHT_BASE_URL=https://penaven.vercel.app npm run test:e2e
```

---

## Project layout

```
prisma/              schema.prisma + migrations
scripts/             seeding, local DB, Vercel env helpers
src/
  app/
    (dashboard)/     signed-in workspace: inbox, tickets, knowledge, widget, hiring, analytics, settings
    api/             route handlers: chat, documents, widget, recruitment, tickets, webhooks, health
    demo/ share/     public hiring samples and shortlist links
    help/ widget/    public help center and embeddable widget
  components/        UI by feature (chat, inbox, knowledge, recruitment, layout, ui, ...)
  lib/               domain logic: rag, ai, gemini, billing, recruitment, widget, auth, env
  generated/prisma/  generated Prisma client (do not edit)
e2e/                 Playwright specs
cloud-run/           optional ops worker
docs/                product and technical docs
```

---

## Routes

| Area | Routes |
|------|--------|
| Support | `/dashboard`, `/inbox`, `/tickets`, `/knowledge`, `/widget`, `/chat` |
| Run log | `/widget/intake`, `/widget/intake/[runId]` |
| Hiring | `/recruitment` → jobs → candidates → compare |
| Boards | `/analytics` |
| Public | `/`, `/help`, `/contact`, `/widget/embed`, `/demo/hiring`, `/share/sample`, `/share/[token]` |

Messages from `/contact` are stored in the `ContactMessage` table (no email is sent); read them with `npm run db:studio`.

---

## Deploying

Production runs on Vercel, with Neon Postgres and Clerk. `vercel.json` runs `db:migrate:deploy` only when `DATABASE_URL` is set, so preview deploys skip migrations. Step-by-step instructions, including the public-demo configuration and the seed call, are in **[DEPLOY.md](./DEPLOY.md)**.

---

## Docs

| Doc | Why |
|-----|-----|
| [docs/README.md](./docs/README.md) | Full documentation index |
| [docs/FOUNDATION.md](./docs/FOUNDATION.md) | Modules, routes, schema, local dev |
| [docs/STRUCTURE.md](./docs/STRUCTURE.md) | Shells, lanes, API map, visual tokens |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design |
| [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md) | Product, ICP, the two lanes |
| [docs/REAL_WORLD_USE.md](./docs/REAL_WORLD_USE.md) | SMB personas and workflows |
| [docs/BUSINESS_PLAN.md](./docs/BUSINESS_PLAN.md) | Problem, price, and the decisions already locked |
| [docs/NAME_RESEARCH_2026-10-23.md](./docs/NAME_RESEARCH_2026-10-23.md) | Why the name is Penaven |
| [DEPLOY.md](./DEPLOY.md) | Production deploy |

## License

Private / portfolio project. Contact the repo owner about terms.
