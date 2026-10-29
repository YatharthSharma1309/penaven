# Penaven documentation

Index for the **Penaven** repo ([penaven](https://github.com/YatharthSharma1309/penaven)). The wordmark on the screens is Penaven. The package name stays `opsconcierge`. The public site is https://penaven.vercel.app.

Start here for product context. Use Technical for setup and architecture.

## Technical

| Doc | Description |
|-----|-------------|
| [FOUNDATION.md](./FOUNDATION.md) | Modules, routes, schema, local dev |
| [STRUCTURE.md](./STRUCTURE.md) | Shells, lanes, demo path, API map, visual tokens |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Vercel, Neon, Clerk, Gemini/OpenRouter, Firebase RTDB |
| [GCP_AND_GEMINI_SETUP.md](./GCP_AND_GEMINI_SETUP.md) | Free Gemini + Firebase Realtime Database |
| [FREE_LLM.md](./FREE_LLM.md) | No-payment path via OpenRouter free models |
| [../DEPLOY.md](../DEPLOY.md) | Production deploy (Vercel + Neon + Clerk) |
| [PROJECTS.md](./PROJECTS.md) | Inventory of GitHub / Vercel / Neon projects vs live web |
| [../README.md](../README.md) | Repo overview, quick start, demo mode |
| [../cloud-run/ops-worker/README.md](../cloud-run/ops-worker/README.md) | Optional Cloud Run worker (not required for the free path) |

## Product

| Doc | Description |
|-----|-------------|
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Product, ICP, support + hiring lanes |
| [REAL_WORLD_USE.md](./REAL_WORLD_USE.md) | SMB personas and day-to-day use |
| [BUSINESS_PLAN.md](./BUSINESS_PLAN.md) | Problem, price, cost check, and the 21 Oct 2026 decision |
| [PLAN_REVIEW_2026-10-22.md](./PLAN_REVIEW_2026-10-22.md) | 22 Oct 2026 outside review. Noted. Does not replace the business plan |
| [PROSPECT_PRACTICE.md](./PROSPECT_PRACTICE.md) | Public competitor examples plus a fictional rehearsal list. Nobody contacted |
| [NAME_RESEARCH_2026-10-23.md](./NAME_RESEARCH_2026-10-23.md) | Selected name: Penaven. Wordmark is on the screens. Domains unregistered |

## Live demo

| Host | Status (checked 24 Oct 2026) |
|------|------------------------------|
| **https://penaven.vercel.app** | **Public** — the only site for this project. `GET /api/health` returned ok, database connected |

Dashboard: https://vercel.com/yatharthsharma1309s-projects/penaven

The Vercel project is `penaven`. The public site is https://penaven.vercel.app. `GET /api/health` checks Postgres.

## Demo path

The screen-by-screen account is in the repo [README](../README.md): the support desk (upload, cited answer, a person, the page you add next) and the hiring lane (resume lines first, then the alignment figure).

Landing → site chat with the passage named → a person when the docs do not cover it → **run log** at `/widget/intake` → optional hiring shortlist. On a candidate, the resume lines come first. You decide.

Sample hiring, no sign-in: `/demo/hiring` and `/share/sample`.

Verify: `GET https://penaven.vercel.app/api/health`

**Price on the landing page:** Free $0. Pro $39/mo. A new workspace stays on Free until a paid plan is stored. The public demo skips the caps.
