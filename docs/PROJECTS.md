# Project inventory (Penaven)

Live inventory checked **7 Aug 2026** (Neon MCP + Vercel CLI + public web).

## Summary

| Layer | Count | Notes |
|-------|-------|-------|
| Product | **1** | Penaven (package `opsconcierge`) |
| Neon Postgres | **3** | Only **SupportAI** powers this app |
| Vercel apps | **6** | Only **penaven** (renamed from relay-ai on 24 Oct 2026) is this app’s deploy |
| GitHub remotes | **2** | `penaven` (canonical, renamed from opsconcierge on 24 Oct 2026) + legacy `relay-ai` |

---

## Neon projects (org: Yatharth / `org-royal-rice-04815983`)

| Neon project | ID | Role for Penaven |
|--------------|----|------------------|
| **SupportAI** | `shy-king-36734093` | **Active DB** (us-east-1, PG 18) — linked in `.neon` |
| debrief | `lucky-river-87858598` | Unrelated |
| ai-sales-assistant-crm | `delicate-truth-29425014` | Unrelated |

---

## Vercel projects (team: yatharthsharma1309s-projects)

| Vercel project | Production URL | Role |
|----------------|----------------|------|
| **penaven** | https://penaven.vercel.app | **Penaven public demo** |
| yatharth-portfolio | https://yatharth-portfolio-tau.vercel.app | Portfolio |
| yatharthsharma | https://yatharthsharma.vercel.app | Personal |
| debrief | https://debrief-psi.vercel.app | Unrelated |
| ai-sales-assistant-crm | https://ai-sales-assistant-crm-phi.vercel.app | Unrelated |
| ai-sales-assistant-crm-api | https://ai-sales-assistant-crm-api.vercel.app | Unrelated |

Dashboard: https://vercel.com/yatharthsharma1309s-projects/penaven

---

## GitHub

| Remote | URL |
|--------|-----|
| **origin** | https://github.com/YatharthSharma1309/penaven |
| relay-ai (legacy) | https://github.com/YatharthSharma1309/relay-ai |

---

## Live demo

**Use:** https://penaven.vercel.app

Earlier addresses for this project, including support-ai-nine-mu.vercel.app and relay-ai-app.vercel.app, were removed on 24 Oct 2026.

Verified **7 Aug 2026** after a production redeploy, and again **21 Oct 2026**. The 21 Oct production deployment is Ready (`relay-aht6svks4`). Git on `master` is still behind that deploy until this working tree is committed.

| Check | Result |
|-------|--------|
| Branding | **OpsConcierge** (Relay AI gone) |
| Demo CTA | Open live demo (auth bypass) |
| `GET /api/health` | ok · database connected |
| Price on `/` | Free $0 with monthly caps · Pro $39/mo |
| Widget | “Answered from your docs” cites the FAQ; a question the docs do not cover cites nothing |

See [GCP_AND_GEMINI_SETUP.md](./GCP_AND_GEMINI_SETUP.md).
