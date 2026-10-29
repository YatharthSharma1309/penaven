# Penaven — Product Vision

**Brand:** Penaven  
**Codebase:** [`penaven`](https://github.com/YatharthSharma1309/penaven) (package: `opsconcierge`; formerly OpsConcierge and Relay AI)  
**Live:** **https://penaven.vercel.app** (public). Earlier Vercel addresses for this project were removed.  
**Real-world playbook:** [`REAL_WORLD_USE.md`](./REAL_WORLD_USE.md)

## Name (23 Oct 2026)

The selected name is **Penaven**. The 23 Oct 2026 pass is in [`NAME_RESEARCH_2026-10-23.md`](./NAME_RESEARCH_2026-10-23.md). `penaven.com`, `penaven.in`, and `penaven.io` were unregistered that evening, and no live software product uses the word. The wordmark on the screens is Penaven. Briefell, Deskora, and Lindwell are closed. The landing page keeps the support-first copy and the indigo-and-teal visual system. The package name stays `opsconcierge`. The public site is https://penaven.vercel.app. The $39 price stays.

## What it is

Penaven is an **ops desk for small businesses** — not a generic chatbot.

It stops founders from re-answering the same billing/returns/hours questions, hands messy cases to a human **with the full transcript**, and helps the same person shortlist hires from resumes that arrive over email or WhatsApp — with auditable support runs and evidence-backed hiring decisions.

## Who it's for (real ICP)

| Buyer | Situation | Why they care |
|-------|-----------|---------------|
| **Founder / ops lead (5–50 people)** | Still owns inbox + hiring | One tool for weekly ops repeats |
| **D2C / Shopify brands** | WISMO, returns, shipping eat the week | Deflect policy FAQs on-site |
| **Early SaaS** | Password/how-to/billing tickets | Docs → answers → ticket with context |
| **Local services / tutoring** | Hours, booking FAQs + occasional hiring | Website FAQ + tutor/tech resume inbox |

**Not v1:** Enterprise ITSM, call-center ACD, or “90% autonomous support” claims.

## Product structure

```
Company memory (FAQs, SOPs, policies)
        │
        ├─► Support concierge: Widget → RAG answer → Escalate → Ticket → Execution log
        │
        └─► Hiring concierge: Role brief → Resume intake → Ranked shortlist → Interview prep
                    (founder posts jobs on Indeed/LinkedIn/referrals — outside the app)
```

### Support lane (primary)

**Real path:** Website chat is where SMBs put self-serve; email remains for disputes.

1. Upload the docs you already have (Notion export, PDF policy, FAQ).
2. Customer asks on the embeddable widget.
3. AI answers **from your docs only**.
4. One-click escalate → ticket with transcript (customers insist on a human option).
5. Review execution log weekly → fix the knowledge base.

### Hiring lane (secondary, same workspace)

**Real path:** Referrals + free Indeed/LinkedIn; founders drown in PDFs.

1. Define must-haves.
2. Upload resumes from any channel.
3. AI ranks with evidence — **never auto-rejects**.
4. Draft interview questions / scorecard hints.
5. Founder confirms hire/reject.

## Design-partner personas

See full detail in [`REAL_WORLD_USE.md`](./REAL_WORLD_USE.md):

| Persona | Vertical | Hero use |
|---------|----------|----------|
| GlowTheory | D2C skincare | Returns / shipping FAQ widget |
| PipelineKit | B2B SaaS | Password / billing / API FAQ + tickets |
| Parkview Dental | Clinic | Hours / insurance FAQ on website |
| Hall’s HVAC | Trades | Service-area / membership triage |
| SummitPrep | Tutoring | Parent FAQ + **tutor hiring** lane |

**Seeded demo:** PipelineKit-style SaaS FAQ (document `support-faq.txt`).

## Honest success bar

| Metric | Realistic first 90 days |
|--------|-------------------------|
| Support deflection | 40–60% of routine FAQs (not 90%) |
| Escalation | Always available; ~25–40% to human is healthy |
| Hiring time saved | ~4–6 hours/hire on screening + question prep |
| Ops hygiene | Weekly log review → KB updates (prevents bot abandonment) |

## Published price

Free is $0: 40 assistant answers a month, 5 resume screens, 1 role. Pro is $39 a month: 250 answers, 40 screens, 5 roles, analytics, and execution exports. The public demo skips these caps. There is no fee per resolved chat, and asking for a person is not billed.

A grounded reply is labeled “Answered from your docs” and cites a source. A reply that is not in the docs says so, cites nothing, and the inbox marks the thread “Waiting on you.” A resume line that denies a required skill is marked Contradicts.

## Related docs

- [`REAL_WORLD_USE.md`](./REAL_WORLD_USE.md) — structure, personas, operator checklist
- [`BUSINESS_PLAN.md`](./BUSINESS_PLAN.md)
