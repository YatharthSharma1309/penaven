import type { Metadata } from "next";
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
import { landingCtas } from "@/components/marketing/landing-ctas";
import { OpsLanesSection } from "@/components/marketing/ops-lanes";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductDemoWalkthrough } from "@/components/marketing/product-demo-walkthrough";
import { buttonClassName } from "@/components/ui/button";
import { razorpayConfig } from "@/lib/billing/razorpay";
import { companyDescription } from "@/lib/brand";
import { isMarketingDemoMode } from "@/lib/env/marketing-demo";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { buildHomeJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
  "Answers from the documents you upload or the help pages you import from your site, with the source named",
  "A clear line when the docs are not enough and a person should take it",
  "Shared inbox and tickets that keep the conversation",
  "A list of questions the docs did not answer, so the knowledge base can improve",
  "Resume lines beside each requirement, a compare, and interview questions",
  "Shortlist status that stays on the candidate",
  "Optional auto-reject per role, off until you turn it on. It acts only on must-have requirements, never the score, is logged, and one click undoes it",
];

const notIncludes = [
  "Replacing your phone line or WhatsApp Business day one",
  "Live order tracking or refunds without your shop APIs",
  "Rejecting anyone on a match score, or “AI decides who to hire”. The score never rejects, and a person’s decision always stands",
  "Enterprise ATS / 50-agent call-center software",
];

export default function LandingPage() {
  const demoMode = isMarketingDemoMode();
  const ctas = landingCtas(demoMode);
  const primaryHref = ctas.primary.href;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHomeJsonLd()) }}
      />
      <MarketingHeader />

      <main id="main-content" className="flex-1">
        {/* Hero — brand + one headline + support + CTAs + product preview */}
        <section className="hero-gradient border-b border-border/80">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-2 lg:gap-14 lg:pb-20 lg:pt-14">
            <div>
              <h1 className="max-w-xl text-balance text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground sm:text-4xl md:text-5xl md:leading-[1.08]">
                Answers from your docs. A person when it isn’t.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted md:text-lg md:leading-8">
                {companyDescription}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={ctas.hero.primary.href}
                  className={buttonClassName({ size: "lg" })}
                >
                  {ctas.hero.primary.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={ctas.hero.secondary.href}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  {ctas.hero.secondary.label}
                </Link>
              </div>
            </div>

            <div className="flex min-w-0 justify-center lg:justify-end">
              <div className="hero-preview-float w-full min-w-0 max-w-md lg:max-w-none">
                <HeroOpsPreview />
              </div>
            </div>
          </div>
        </section>

        <FounderPainsSection />

        <HowItWorksSection demoMode={demoMode} links={ctas.howItWorks} />

        <ProductDemoWalkthrough demoMode={demoMode} />

        <section
          id="features"
          className="scroll-mt-20 border-b border-border/80 bg-surface"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-balance text-section font-semibold text-foreground">
              Support every week. Hiring when a role opens.
            </h2>
            <p className="mt-2 max-w-2xl text-pretty text-foreground-soft">
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
          className="scroll-mt-20 border-b border-border/80 bg-surface-sunken"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-section font-semibold text-foreground">
              Built for real small businesses
            </h2>
            <p className="mt-2 max-w-2xl text-foreground-soft">
              If you are under ~50 people and still own the inbox, you are the
              buyer, not enterprise IT.
            </p>
            <ul className="mt-10 divide-y divide-border border-y border-border">
              {personas.map((persona) => (
                <li
                  key={persona.name}
                  className="grid gap-2 py-5 sm:grid-cols-[14rem_1fr] sm:gap-8"
                >
                  <p className="font-semibold text-foreground">{persona.name}</p>
                  <p className="text-sm leading-6 text-foreground-soft">
                    {persona.use}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="scope"
          className="scroll-mt-20 border-b border-border/80 bg-surface"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-section font-semibold text-foreground">
              What you get, and what we do not claim
            </h2>
            <p className="mt-2 max-w-2xl text-foreground-soft">
              No “90% autonomous support” claim. Nobody has measured one for
              Penaven yet, so it is not on this page.
            </p>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-foreground-soft">
                  Included
                </h3>
                <ul className="mt-4 space-y-3">
                  {includes.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-sm leading-6 text-foreground-soft"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground-soft">
                  Not in v1
                </h3>
                <ul className="mt-4 space-y-3">
                  {notIncludes.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-sm leading-6 text-foreground-soft"
                    >
                      <span className="flex h-6 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                        <span className="h-px w-2.5 bg-slate-400" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 max-w-2xl text-sm leading-6 text-muted">
              A deflection percentage is a vendor metric. What you get is an
              answer that names the document, and a person when the document
              is not enough.
            </p>
          </div>
        </section>

        <PricingSection
          demoMode={demoMode}
          primaryHref={primaryHref}
          checkoutReady={!isPublicDemoMode() && razorpayConfig() !== null}
        />

        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-section font-semibold text-foreground">
              {demoMode
                ? "Walk the full path in the live demo"
                : "Put your FAQ to work this week"}
            </h2>
            <p className="mt-2 max-w-xl text-foreground-soft">
              {demoMode
                ? "Command center → widget chat → escalate → execution log → optional hiring shortlist. No sign-in required in demo mode."
                : "Upload one policy, put the chat on your site, and hand messy threads to a person with the full conversation."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={ctas.closing.primary.href}
                className={buttonClassName({ size: "lg" })}
              >
                {ctas.closing.primary.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={ctas.closing.secondary.href}
                className={buttonClassName({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                {ctas.closing.secondary.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
