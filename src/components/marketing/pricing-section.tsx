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

/**
 * Plain pricing terms. The cap line matches assistantCapReply and the widget
 * stream route: at the cap no model call is made, the visitor gets a handoff
 * line, and "Ask a person" still opens a ticket.
 */
export const PRICING_TERMS = {
  flat: "One flat monthly price. No per-resolution or per-answer fees.",
  atCap: `When a workspace has used its ${PLANS.free.assistantAnswersPerMonth} (Free) or ${PLANS.pro.assistantAnswersPerMonth} (Pro) answers for the month, the chat stops writing AI answers. It tells the visitor a person can pick it up, and the visitor can ask a person to take the conversation as a ticket. The count resets on the 1st (UTC).`,
} as const;

/**
 * The Pro note says what this deployment really does. Checkout needs the four
 * RAZORPAY_ values and is off on the public demo, so it only claims payment
 * when the page was told checkout is ready.
 */
export function proPlanNote(checkoutReady: boolean): string {
  return checkoutReady
    ? "Every workspace starts on Free. Upgrade to Pro in Settings, paid through Razorpay."
    : "Billing isn't on yet. Every workspace starts on Free.";
}

export function pricingPlans({
  demoMode,
  primaryHref,
  checkoutReady = false,
}: {
  demoMode: boolean;
  primaryHref: string;
  checkoutReady?: boolean;
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
      note: proPlanNote(checkoutReady),
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
        <p className="text-sm font-medium text-muted">
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
  checkoutReady = false,
}: {
  demoMode: boolean;
  primaryHref: string;
  checkoutReady?: boolean;
}) {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-b border-border/80 bg-surface-sunken"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="reveal text-section font-semibold text-foreground">
          Simple pricing for small businesses
        </h2>
        <p className="mt-2 max-w-2xl text-foreground-soft">
          Support answers and resume screening in one workspace.{" "}
          {PRICING_TERMS.flat}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-foreground-soft">
          {PRICING_TERMS.atCap}
        </p>
        <div className="reveal-stagger mt-10 grid gap-8 lg:max-w-5xl lg:grid-cols-2">
          {pricingPlans({ demoMode, primaryHref, checkoutReady }).map((plan) => (
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
        <p className="mt-4 max-w-2xl text-sm text-muted">
          The public demo skips these caps.
        </p>
      </div>
    </section>
  );
}
