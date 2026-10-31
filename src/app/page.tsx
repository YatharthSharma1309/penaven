import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { FounderPainsSection } from "@/components/marketing/founder-pains-section";
import { HeroOpsPreview } from "@/components/marketing/hero-ops-preview";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { OpsLanesSection } from "@/components/marketing/ops-lanes";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductDemoWalkthrough } from "@/components/marketing/product-demo-walkthrough";
import { buttonClassName } from "@/components/ui/button";
import { companyDescription } from "@/lib/brand";
import { isMarketingDemoMode } from "@/lib/env/marketing-demo";

const personas = [
  {
    name: "Early SaaS teams",
    use: "Password, billing, and how-to answers from the docs you already have. Hand the rest to a person with the thread.",
  },
  {
    name: "D2C / Shopify brands",
    use: "Returns, shipping, and “where is my order?” policy answers on the store site.",
  },
  {
    name: "Clinics & local services",
    use: "Hours, insurance basics, membership FAQs while booking stays in your system.",
  },
  {
    name: "Tutoring & agencies",
    use: "Parent FAQ plus a hiring inbox when you screen tutors or support hires.",
  },
];

const includes = [
  "Answers from the documents you upload, with the source named",
  "A clear line when the docs are not enough and a person should take it",
  "Shared inbox and tickets that keep the conversation",
  "A list of questions the docs did not answer, so the knowledge base can improve",
  "Resume lines beside each requirement, a compare, and interview questions",
  "Shortlist status that stays on the candidate",
];

const notIncludes = [
  "Replacing your phone line or WhatsApp Business day one",
  "Live order tracking or refunds without your shop APIs",
  "Auto-rejecting candidates or “AI decides who to hire”",
  "Enterprise ATS / 50-agent call-center software",
];

export default function LandingPage() {
  const demoMode = isMarketingDemoMode();
  const primaryHref = demoMode ? "/dashboard" : "/sign-up";
  const secondaryHref = demoMode ? "/widget" : "/help";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <main id="main-content" className="flex-1">
        {/* Hero — brand + one headline + support + CTAs + product preview */}
        <section className="hero-gradient border-b border-border/80">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-2 lg:gap-14 lg:pb-20 lg:pt-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Support desk for small teams
              </p>
              <h1 className="mt-3 max-w-xl text-balance text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground sm:text-4xl md:text-5xl md:leading-[1.08]">
                Answers from your docs. A person when it isn’t.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted md:text-lg md:leading-8">
                {companyDescription}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={primaryHref}
                  className={buttonClassName({ size: "lg" })}
                >
                  {demoMode ? "Open live demo" : "Get started free"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={demoMode ? "/#try-demo" : secondaryHref}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  {demoMode ? "Explore the demo" : "Help center"}
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                Documentation-grounded answers · Human handoff · Evidence-backed
                hiring
              </p>
            </div>

            <div className="flex min-w-0 justify-center lg:justify-end">
              <div className="hero-preview-float w-full min-w-0 max-w-md lg:max-w-none">
                <HeroOpsPreview />
              </div>
            </div>
          </div>
        </section>

        <FounderPainsSection />

        <HowItWorksSection
          demoMode={demoMode}
          primaryHref={primaryHref}
          secondaryHref={secondaryHref}
        />

        <ProductDemoWalkthrough demoMode={demoMode} />

        <section
          id="features"
          className="scroll-mt-20 border-b border-slate-200/80 bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-balance text-2xl font-semibold text-slate-900">
              Support every week. Hiring when a role opens.
            </h2>
            <p className="mt-2 max-w-2xl text-pretty text-slate-600">
              The weekly job is the inbox. The shortlist stays in the same
              workspace for the weeks you are hiring.
            </p>

            <OpsLanesSection
              showDemoCta={demoMode}
              className="mt-12"
            />
          </div>
        </section>

        <section
          id="who"
          className="scroll-mt-20 border-b border-slate-200/80 bg-slate-50"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold text-slate-900">
              Built for real small businesses
            </h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              If you are under ~50 people and still own the inbox, you are the
              buyer — not enterprise IT.
            </p>
            <ul className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
              {personas.map((persona) => (
                <li
                  key={persona.name}
                  className="grid gap-2 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8"
                >
                  <p className="font-semibold text-slate-900">{persona.name}</p>
                  <p className="text-sm leading-6 text-slate-600">
                    {persona.use}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="scope"
          className="scroll-mt-20 border-b border-slate-200/80 bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold text-slate-900">
              What you get — and what we do not claim
            </h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              Honest scope beats “90% autonomous support” marketing that SMBs
              abandon in 30 days.
            </p>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Included
                </h3>
                <ul className="mt-4 space-y-3">
                  {includes.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-sm leading-6 text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Not in v1
                </h3>
                <ul className="mt-4 space-y-3">
                  {notIncludes.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-sm leading-6 text-slate-700"
                    >
                      <span className="mt-0.5 inline-block h-4 w-4 shrink-0 text-center text-slate-400">
                        –
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 max-w-2xl text-sm leading-6 text-slate-500">
              A deflection percentage is a vendor metric. What you get is an
              answer that names the document, and a person when the document
              is not enough.
            </p>
          </div>
        </section>

        <PricingSection demoMode={demoMode} primaryHref={primaryHref} />

        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold text-slate-900">
              {demoMode
                ? "Walk the full path in the live demo"
                : "Put your FAQ to work this week"}
            </h2>
            <p className="mt-2 max-w-xl text-slate-600">
              {demoMode
                ? "Command center → widget chat → escalate → execution log → optional hiring shortlist. No sign-in required in demo mode."
                : "Upload one policy, put the chat on your site, and hand messy threads to a person with the full conversation."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={primaryHref} className={buttonClassName({ size: "lg" })}>
                {demoMode ? "Open live demo" : "Get started free"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={demoMode ? "/#how-it-works" : "/help"}
                className={buttonClassName({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                {demoMode ? "How it works" : "Help center"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
