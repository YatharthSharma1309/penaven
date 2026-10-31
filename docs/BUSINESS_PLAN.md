# Penaven — Lean Business Plan

Grounded in real SMB support/hiring behavior. Portfolio length.

---

## Problem (observed in the market)

Founders of 5–50 person companies still run ops from **email + DMs + a spreadsheet**:

- **Support:** Same questions every week (returns, WISMO, password, hours, billing). Website chat helps only if answers stay grounded in *their* policies.
- **Handoff:** Chatbots that loop without a human path destroy trust (~87% of customers want a human option when GenAI is used — [Gartner 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)).
- **Maintenance:** AI tools die after 30 days when nobody reviews wrong answers ([SMB AI abandonment patterns](https://research.briankeefe.dev/20260319-170040-smb-ai-backlash)).
- **Hiring:** Referrals + free Indeed/LinkedIn dumps 50–200 PDFs on a founder with no rubric ([FirstHR SMB process](https://firsthr.app/blog/hiring/recruitment-process)).

## Solution

**Penaven** = company memory + two lightweight lanes:

| Lane | Real job to be done |
|------|---------------------|
| **Support** | Deflect routine FAQs on the website widget; escalate with transcript; leave an execution log |
| **Hiring** | Rank resumes with evidence; draft interview questions; human confirms (no auto-hire) |

See [`REAL_WORLD_USE.md`](./REAL_WORLD_USE.md) for personas and day-to-day use.

## Target customer

| Attribute | Detail |
|-----------|--------|
| **Size** | 5–50 employees |
| **Primary** | D2C / early SaaS with a website and a messy FAQ |
| **Secondary** | Local services & tutoring (FAQ + occasional hiring) |
| **Buyer** | Founder or ops lead (still answers tickets personally) |
| **Trigger** | &gt;10 hrs/week on repeat questions **or** a hiring sprint |

**Not targeting (v1):** 50+ agent contact centers, on-prem regulated ITSM, “fire the support team” buyers.

## Value proposition

> Stop re-typing the same answers. When AI can’t help, hand off with the full story. When you’re hiring, read a ranked shortlist — not eighty resumes. Support runs are logged so your knowledge base gets better.

## Business model (lite)

| Tier | Price | Fit |
|------|-------|-----|
| Free | $0 | 40 assistant answers / month, 5 resume screens, 1 role — design partners |
| Pro | $39/mo | 250 assistant answers, 40 resume screens, 5 roles, analytics, execution exports |
| Enterprise | Custom | Later (SSO, private deploy) — not the wedge |

**31 Oct 2026:** Billing is not on, so no plan limits features. Free and Pro both show analytics and the shortlist export. The Pro row above stays the target and applies when checkout ships.

Avoid per-resolution “gotcha” pricing that buyers hate on Intercom/Zendesk AI.

## Cost check (21 Oct 2026)

No `GEMINI_API_KEY` was available in this workspace, so this table is Gemini 3.5 Flash’s published rate card ($1.50 / 1M input, $9 / 1M output, thinking included), not ten billed invoices. Live widget answers and resume screens now store input tokens, output tokens, and dollars on the execution log and the hiring audit once a key is set.

| Run | Basis | Cost |
|-----|--------|------|
| Widget answer, heavy | 3,000 in + 8,000 out | $0.0765 |
| Widget answer, short | 1,500 in + 800 out | $0.0095 |
| Escalation | short answer + short triage | $0.0189 |
| Resume screen, heavy | 8,000 in + 4,000 out | $0.048 |
| One role, 20 heavy screens | 20 × screen | $0.96 |
| Pro month at the caps, all heavy | 250 answers + 40 screens | about $21 |

$21 clears $39. The caps stay. The price stays $39. A month of 300 uncapped heavy replies was the old sketch; the published cap is 250 so the heavy case stays inside the price.

## Phase 4 decision (21 Oct 2026)

| Question | Decision |
|----------|----------|
| Support path, no invented policy | Checked on the live demo 21 Oct 2026. A refund question was labeled “Answered from your docs” and cited the FAQ. An Austin street-address question said the docs do not cover it, cited nothing, and the inbox marked the thread “Waiting on you.” |
| Resume lines and decisions that persist | Keep hiring in the same app. |
| Did three of five founders want both lanes? | Not decided. Design-partner talks are 0. Do not drop a lane from a guess. |
| Does Pro cover model cost? | Yes, at $39 with 250 answers and 40 screens. Publish that price. |
| What did founders call unfinished? | Nothing yet. This build is on the public demo as of 21 Oct 2026. Next is the five conversations below. No new channel. |

Dated reason for no payment: no founder conversation has been held, so there is no payment to record.

Ask these seven questions, and write the answers in this file. Do not change the roadmap from a feature request that does not come with a payment.

1. How many hours a week go to the same questions?
2. Where do those questions arrive?
3. What happens when the chatbot is wrong?
4. How many resumes did the last hire produce, and what did they use?
5. What do they pay now?
6. After watching both lanes, which one would they open next week?
7. Would they pay $39 a month, or a one-time fee for a single role? Which, and why?

If they hire once a year and have no support volume, HireScreen fits them better. If they run a recruiting agency, Manatal fits them better.

## Go-to-market (90 days)

1. **Persona-led demos** — PipelineKit (SaaS FAQ) and GlowTheory (returns FAQ) scripts  
2. **Design partners** — 3–5 real SMBs you can name from public sites  
3. **Wedge channel** — Website widget only (prove value before WhatsApp/IG)  
4. **Proof** — Deflection %, escalations with context, hiring hours saved (real numbers only)  

## Competition (honest)

| Alternative | Gap we fill |
|-------------|-------------|
| Intercom / Zendesk | Cheaper ops desk + hiring lane; less admin |
| Gorgias | Works beyond Shopify; shared memory with hiring |
| Tidio / cheap bots | Tickets + execution audit, not just chat |
| ChatGPT | Org memory, escalate, log |
| Greenhouse / Lever | Too heavy; we are the founder’s resume inbox |

## Traction (fill with real numbers)

| Metric | Current | 90d target |
|--------|---------|------------|
| Live demo | ✅ public host, production Ready 21 Oct 2026 | Keep the public demo up |
| Design-partner talks | 0 | 5 |
| Widget sessions / week | Demo-only (not claimed as customers) | 50+ real |
| FAQ deflection (pilot) | n/a | 40–60% routine |
| Paying SMBs | **0** (honest) | ≥1 arms-length if chasing viability |

## Risks

| Risk | Mitigation |
|------|------------|
| Hallucinations | RAG + citations + mandatory escalate |
| Over-promising autonomy | Market 40–60% deflection, not 90% |
| Bot abandonment | Weekly execution-log → KB ritual |
| Hiring legal exposure | Advisory ranking only; human decision; no auto-reject |

---

## Review noted (22 Oct 2026)

An outside review is recorded in [`PLAN_REVIEW_2026-10-22.md`](./PLAN_REVIEW_2026-10-22.md). The team reads it before the next product, pricing, or customer step. The Phase 4 decisions above stay in force. The published price stays $39. Founder talks stay at 0 until a real conversation is written here.

The selected name is **Penaven**, recorded in [`NAME_RESEARCH_2026-10-23.md`](./NAME_RESEARCH_2026-10-23.md). The wordmark on the screens is Penaven. The price stays $39.

---

**Playbook:** [`REAL_WORLD_USE.md`](./REAL_WORLD_USE.md)  
**Review:** [`PLAN_REVIEW_2026-10-22.md`](./PLAN_REVIEW_2026-10-22.md)  
**Live:** https://penaven.vercel.app. Earlier Vercel addresses for this project were removed.
