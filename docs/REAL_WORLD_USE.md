# Penaven — Real-world structure & use

Grounded in how 5–50 person businesses actually run support and hiring in 2025–2026 — not enterprise helpdesk theater.

**Sources (selected):** [Forethought channel mix](https://forethought.ai/blog/voice-chat-email-which-support-channel-should-you-focus-on-in-2025) · [Pixeltree DTC tickets](https://www.pixeltree.store/blog/ai-support-dtc-brands-2026) · [Gartner human handoff](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0) · [Builts.ai AI deflection](https://builts.ai/blog/ai-customer-service-trends-2026/) · [FirstHR SMB hiring](https://firsthr.app/blog/hiring/recruitment-process) · [EEOC AI hiring guidance](https://www.eeoc.gov/laws/guidance/select-issues-assessing-adverse-impact-software-algorithms-and-artificial)

---

## What real SMBs do today

| Reality | Implication for Penaven |
|---------|-------------------------|
| Email + website chat are the default pair; WhatsApp/IG DMs are fast but messy | **Wedge = website widget** first — not rip-and-replace Zendesk |
| ~65–75% of DTC tickets are routine (order status, returns, shipping, billing) | Own **FAQ deflection**, not live tracking/refunds without integrations |
| ~87% of customers want a human escape when GenAI is used | **Escalate with full transcript** — never AI-loop hell |
| Mature AI deflection is ~55–70%, not “90% day one” | Market as **deflect + triage + proof**, not full autonomy |
| Founders hire via referrals + free Indeed/LinkedIn; resumes arrive as PDFs/WhatsApp | Hiring lane = **intake + ranked shortlist + interview prep**, not an ATS |
| AI tools get abandoned when nobody reviews them | **Execution log + weekly KB review** is the product loop |

---

## Product structure (refined)

```
Penaven workspace
├── Company memory          Upload FAQ / SOP / policy / pricing (sources of truth)
├── Support concierge
│   ├── Website widget      Customer asks → RAG answer → “Was this helpful?”
│   ├── Escalate → ticket   Transcript + sources + reason for handoff
│   └── Execution log       Model, latency, deflect vs escalate, ticket link
├── Hiring concierge
│   ├── Role brief          Must-haves + draft JD (founder still posts on Indeed/LI)
│   ├── Resume intake       PDFs from email / Drive / WhatsApp
│   ├── Ranked shortlist    Evidence-backed match — human decides (no auto-reject)
│   └── Interview prep      5–8 questions + simple scorecard hints
└── Ops review              Analytics: top unanswered themes → update memory
```

### Explicit non-goals (v1)

- WhatsApp/IG native inboxes (later)
- Live order tracking / PMS booking / refunds without APIs
- Auto-reject candidates or AI “hire decision”
- Enterprise ATS / Zendesk replacement for 50+ agent teams

---

## Primary workflows (day-to-day)

### A. Support — “Stop answering the same 15 questions”

1. Owner uploads real docs (returns policy, hours, billing FAQ).
2. Customer uses site widget (or demo at `/widget`).
3. AI answers **only from docs**; cites sources when possible.
4. If unsure / customer asks for human → **Escalate to ticket** with transcript.
5. Owner reviews `/widget/intake` or tickets weekly → adds missing FAQ rows.

**Honest target:** 40–60% deflection in first 90 days on clean FAQs (routine only).

### B. Hiring — “Founder’s hiring inbox”

1. Founder defines must-haves (Job Assist).
2. Posts **outside** the product (Indeed free / LinkedIn / referrals).
3. Uploads resumes into Penaven.
4. AI ranks with **why / why not**; founder shortlists in 15–30 min.
5. Uses generated questions for a **structured** interview; confirms hire/reject in UI.

**Honest target:** Save 4–6 hours per hire on screening + question prep — not replace judgment.

---

## Five design-partner personas (realistic)

Use these for demos, outreach, and seeded FAQs. Names are fictional; volumes match public benchmarks.

### 1. GlowTheory — D2C skincare (Shopify)
- **~12 people · ~160–240 support tickets/mo**
- **Pain:** WISMO, returns, shade/sizing; founder still on IG DMs weekends
- **Penaven use:** Widget on store + returns/shipping FAQ; escalate billing disputes
- **Demo questions:** “What’s your refund window?” · “Do you ship internationally?”

### 2. PipelineKit — B2B SaaS (dev tools)
- **~22 people · ~450 tickets/mo**
- **Pain:** Password/MFA, how-to, billing; docs lag product
- **Penaven use:** In-app/help widget; escalate SSO bugs to ticket with transcript
- **Demo questions:** “How do I reset my password?” · “What are API rate limits?”

### 3. Parkview Dental — single clinic
- **~18 people · phone-heavy**
- **Pain:** Hours, insurance “do you take X?”, book/cancel (booking stays in PMS)
- **Penaven use:** Website FAQ widget for hours/insurance basics; escalate clinical urgency
- **Demo questions:** “What are your hours?” · “Do you accept Delta Dental?”

### 4. Hall’s HVAC — local trades
- **~9 people · seasonal call spikes**
- **Pain:** “Can someone come today?”, membership terms; emergency vs callback
- **Penaven use:** Website triage FAQ; escalate “no heat / gas smell” immediately
- **Demo questions:** “What areas do you serve?” · “What’s included in maintenance plans?”

### 5. SummitPrep Tutoring — online + hybrid
- **~8 staff + contractors · WhatsApp-heavy admin**
- **Pain:** Reschedule, package balance, tutor match; also hires tutors often
- **Penaven use:** Parent FAQ widget + **hiring lane** for tutor resumes
- **Demo questions:** “How do I reschedule?” · Upload tutor CV → shortlist

**Default seeded demo persona:** PipelineKit-style SaaS FAQ (document `support-faq.txt`) — matches current product surface (billing, password, API limits, escalation).

---

## How to use the product (operator checklist)

| Cadence | Action |
|---------|--------|
| **Day 0** | Pick one persona; upload 1–2 real policy docs; embed/preview widget |
| **Daily** | Clear escalated tickets; don’t leave AI without a human path |
| **Weekly** | Open execution log / analytics; add top 5 unanswered themes to knowledge |
| **Per hire** | Must-haves → intake resumes → shortlist → interview Qs → human confirm |

---

## Positioning vs alternatives

| Alternative | Real gap Penaven fills |
|-------------|-----------------------|
| Intercom / Zendesk AI | Heavy setup + seat/resolution fees; weak hiring story for founders |
| Gorgias | Strong for Shopify tickets; not general ops + hiring |
| Tidio / cheap chatbots | Deflection without serious ticket audit trail |
| Raw ChatGPT | No org memory, tickets, or execution log |
| Full ATS (Greenhouse etc.) | Overkill for &lt;50 apps/role and referral-led hiring |

> **One-liner:** Penaven is the ops desk for founders who still live in email, a website chat bubble, and Indeed — AI deflects the repeats, hands off cleanly, and leaves a trail so the knowledge base gets better every week.

---

## Related

- [`PRODUCT_VISION.md`](./PRODUCT_VISION.md) · [`BUSINESS_PLAN.md`](./BUSINESS_PLAN.md)
