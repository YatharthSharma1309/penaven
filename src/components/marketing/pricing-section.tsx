import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export type PricingPlan = {
  name: string;
  tagline: string;
  amount: string;
  unit: string;
  note: string;
  features: string[];
  cta: string;
  href: string;
  variant: "primary" | "secondary";
  recommended?: boolean;
};

/** Pro's monthly answers spread over a 30-day month, from PLANS. */
export const proAnswersPerDay = Math.round(
  PLANS.pro.assistantAnswersPerMonth / 30,
);

export function pricingPlans({
  demoMode,
  primaryHref,
}: {
  demoMode: boolean;
  primaryHref: string;
}): PricingPlan[] {
  return [
    {
      name: "Free",
      tagline: "Try it on your FAQ and one open role.",
      amount: `$${PLANS.free.priceUsd}`,
      unit: "/ month",
      note: "Every new workspace starts here.",
      features: [
        `${PLANS.free.assistantAnswersPerMonth} assistant answers / month`,
        `${PLANS.free.resumeScreensPerMonth} resume screens / month`,
        `${PLANS.free.roles} role`,
        "Analytics",
        "Shortlist export",
      ],
      cta: demoMode ? "Open live demo" : "Get started free",
      href: primaryHref,
      variant: "secondary",
    },
    {
      name: "Pro",
      tagline: `About ${proAnswersPerDay} answers a day, for a small team answering support.`,
      amount: `$${PLANS.pro.priceUsd}`,
      unit: "/ month",
      note: "Billing isn't on yet. Every workspace starts on Free.",
      features: [
        `${PLANS.pro.assistantAnswersPerMonth} assistant answers / month`,
        `${PLANS.pro.resumeScreensPerMonth} resume screens / month`,
        `${PLANS.pro.roles} roles`,
        "Analytics",
        "Shortlist export",
      ],
      // A new workspace starts on Free, so the label says what sign-up does.
      cta: demoMode ? "Try the demo path" : "Start on Free",
      href: demoMode ? "/#try-demo" : primaryHref,
      variant: "primary",
      recommended: true,
    },
  ];
}

function PlanList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-6 text-foreground/85">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-surface-raised p-6",
        // A ring, not border-2, so every card keeps the same box size.
        plan.recommended
          ? "border-primary shadow-lg ring-1 ring-primary"
          : "border-border shadow-sm",
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {plan.name}
        </p>
        {plan.recommended ? <Badge tone="info">Recommended</Badge> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted lg:min-h-12">
        {plan.tagline}
      </p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-foreground">
          {plan.amount}
        </span>
        <span className="text-sm font-medium text-muted">{plan.unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted">{plan.note}</p>
      <Link
        href={plan.href}
        className={buttonClassName({
          variant: plan.variant,
          size: "md",
          className: "mt-5 h-10 w-full",
        })}
      >
        {plan.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
      <div className="mt-5">
        <PlanList items={plan.features} />
      </div>
    </div>
  );
}

export function PricingSection({
  demoMode,
  primaryHref,
}: {
  demoMode: boolean;
  primaryHref: string;
}) {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-b border-slate-200/80 bg-slate-50"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Simple pricing for small businesses
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Support answers and resume screening in one workspace, for one
          monthly price. No{" "}
          <span className="whitespace-nowrap">per-resolution</span> fees. Past
          the monthly cap, the
          widget offers a person instead.
        </p>
        <div className="mt-10 grid gap-8 lg:max-w-5xl lg:grid-cols-2">
          {pricingPlans({ demoMode, primaryHref }).map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Need SSO or a private deploy later?{" "}
          <Link
            href="/contact"
            className="font-medium text-primary hover:underline"
          >
            Tell us
          </Link>
          . It isn&apos;t built yet.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-slate-500">
          The public demo skips these caps.
        </p>
      </div>
    </section>
  );
}
