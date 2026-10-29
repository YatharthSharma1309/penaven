# Penaven — production deployment

Vercel (Next.js) + Neon Postgres + Clerk, with Gemini and/or OpenRouter for LLM, and optional Firebase RTDB for agent-run evidence.

## Architecture

```
Browser → Vercel (Next.js) → Neon PostgreSQL
         ↓
       Clerk (auth + orgs; demo bypass optional)
         ↓
       Gemini and/or OpenRouter (chat + RAG)
         ↓
       Firebase RTDB (optional agent-run evidence)
```

## Prerequisites

- [ ] GitHub repo: [`YatharthSharma1309/penaven`](https://github.com/YatharthSharma1309/penaven)
- [ ] [Neon](https://neon.tech) PostgreSQL project
- [ ] [Clerk](https://clerk.com) application (production instance) — or demo bypass vars for portfolio-only deploys
- [ ] [OpenRouter](https://openrouter.ai) and/or [Gemini](https://aistudio.google.com/apikey) API key
- [ ] Optional: [Firebase](https://console.firebase.google.com/) Realtime Database for execution evidence

## 1. Neon database

1. Create project → copy **pooled** connection string with `sslmode=require`
2. Set as `DATABASE_URL` in Vercel

## 2. Clerk

1. Create application → copy publishable + secret keys
2. Enable Organizations
3. Configure sign-in/sign-up URLs for your Vercel domain
4. Webhooks → add endpoint `https://YOUR-APP.vercel.app/api/webhooks/clerk`
5. Copy webhook signing secret → `CLERK_WEBHOOK_SIGNING_SECRET` (the name `verifyWebhook()` reads)

Skip Clerk setup only if you intentionally ship a **public demo** with auth bypass (see Portfolio section). Never use bypass for a real customer tenant.

## 3. Vercel environment variables

| Item | Value |
|------|--------|
| GitHub | https://github.com/YatharthSharma1309/penaven |
| Current production host | **https://penaven.vercel.app** (public). Earlier Vercel addresses for this project were removed on 24 Oct 2026 |

Set `APP_URL` to your primary production URL.

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon pooled URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes* | *Not needed if demo bypass only |
| `CLERK_SECRET_KEY` | Yes* | |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Yes* | Clerk webhook signing secret |
| `WIDGET_VISITOR_SECRET` | Yes* | Signs widget visitor sessions. Production refuses to start without it |
| `OPENROUTER_API_KEY` | Recommended | Free models via `openrouter/free`. Required when `PUBLIC_DEMO_MODE` is on |
| `GEMINI_API_KEY` | Support LLM | Pair with `AI_PROVIDER_PREFERENCE=auto` |
| `FIREBASE_DATABASE_URL` | Optional | RTDB evidence of agent runs |
| `AI_PROVIDER_PREFERENCE` | No | `openrouter` (free path) · `auto` (default) · `gemini` |
| `APP_URL` | Yes | `https://YOUR-APP.vercel.app` |
| `OPENROUTER_CHAT_MODEL` | No | Default `openrouter/free` |
| `DEMO_SEED_SECRET` | Demo | Random string for `POST /api/demo/seed`. Without it the seed is disabled in production. Required when `PUBLIC_DEMO_MODE` is on |
| `AUTH_BYPASS` | **Never on real prod** | Portfolio demo only |

Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for distributed rate limits.  
Optional: `OPS_WORKER_URL` if you deploy [`cloud-run/ops-worker`](./cloud-run/ops-worker/README.md).

Full local reference: [`.env.example`](./.env.example). Free LLM notes: [`docs/FREE_LLM.md`](./docs/FREE_LLM.md).

## 4. Build settings

Vercel project: **penaven** (team `yatharthsharma1309s-projects`). `vercel.json` build command:

```
if [ -n "$DATABASE_URL" ]; then npm run db:migrate:deploy; fi && npm run db:generate && npm run build
```

Preview deploys have no `DATABASE_URL`, so they skip migrate. Production has the database URL, so migrate runs there.

Or run migrations post-deploy from local:

```bash
DATABASE_URL="..." npm run db:migrate:deploy
```

## 5. Post-deploy seed

```bash
curl -X POST https://YOUR-APP.vercel.app/api/demo/seed \
  -H "x-demo-seed-secret: YOUR_DEMO_SEED_SECRET"
```

Then upload 2–3 FAQ documents on **Knowledge**. Seed also creates a sample recruitment job at `/recruitment`.

## 6. Widget + execution log demo

1. Sign in (or open demo mode) → **Widget** (`/widget`) → copy embed snippet
2. Chat on the widget → escalate to a ticket
3. Open **`/widget/intake`** to show the execution log

## 7. Portfolio / public demo

**Live demo (public):** https://penaven.vercel.app

### Redeploy checklist

1. Deploy this repo to the Vercel project **penaven**
2. Set `APP_URL=https://penaven.vercel.app`
3. Confirm landing title is **Penaven | Support desk for small teams**
4. `curl -s https://penaven.vercel.app/api/health`

Recommended walkthrough when `PUBLIC_DEMO_MODE` is enabled (no sign-in):

1. **Landing** → **Open live demo**
2. **Dashboard** — setup health, stats, recent tickets
3. **Chat** (`/chat`) — ask a FAQ; show citations
4. **Widget intake** (`/widget/intake`) — execution log for a run
5. **Recruitment** (`/recruitment`) — demo job → candidate → **Run analysis**
6. **Boards** (`/analytics`) — deflection / knowledge gaps
7. **Help center** (`/help/demo-company`) — public KB + widget
8. **Widget** (`/widget`) — embed preview

### Portfolio env (Vercel — demo only)

```bash
node scripts/push-vercel-env.mjs   # sync demo env from local .env
npx vercel --prod --yes
curl -X POST https://YOUR-APP.vercel.app/api/demo/seed \
  -H "x-demo-seed-secret: YOUR_DEMO_SEED_SECRET"
```

| Variable | Portfolio demo |
|----------|----------------|
| `PUBLIC_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_PUBLIC_DEMO_MODE` | `true` |
| `AUTH_BYPASS` | `true` (demo only) |
| `NEXT_PUBLIC_AUTH_BYPASS` | `true` |
| `DEMO_WIDGET_KEY` | stable key for embed/tests |
| `APP_URL` | your Vercel URL |

For a **private production** app, remove demo bypass vars and configure Clerk keys instead.

## Smoke test

- [ ] `GET /api/health` returns OK
- [ ] Sign up + create org (or demo dashboard opens)
- [ ] Upload document → chat with citation
- [ ] Widget escalate → ticket → `/widget/intake` log
- [ ] `/recruitment` — demo job + candidate pipeline

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Clerk redirect loop | Set correct URLs in Clerk dashboard |
| DB connection error | Use Neon pooled URL with SSL |
| Chat empty / 429 | Use `AI_PROVIDER_PREFERENCE=openrouter` + valid `OPENROUTER_API_KEY`; or fix Gemini quota |
| Webhook 400 | Check `CLERK_WEBHOOK_SIGNING_SECRET` |
| No execution log | Chat via **widget** stream path, then open `/widget/intake` |

## Security

- Never set `AUTH_BYPASS` or `E2E_AUTH_BYPASS` on a real customer production tenant
- Do not commit `.env` or real API keys
- Set OpenRouter / Gemini spend limits where available
