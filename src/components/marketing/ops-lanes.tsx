import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import {
  SAMPLE_SHORTLIST_HREF,
  SAMPLE_SHORTLIST_LABEL,
} from "@/components/marketing/landing-ctas";
import { buttonClassName } from "@/components/ui/button";
import { hiringWorkspaceHref } from "@/lib/env/public-demo";
import { cn } from "@/lib/utils";

export type OpsLaneId = "support" | "hiring";

export type OpsLaneTone = "navy" | "teal";

export type OpsLaneConfig = {
  id: OpsLaneId;
  tone: OpsLaneTone;
  label: string;
  title: string;
  pathSteps: string[];
  summary: string;
  bullets: string[];
  icon: LucideIcon;
  demoHref: string;
  demoCta: string;
  /** Without demo mode: a page a visitor can open with no account. */
  publicHref: string;
  publicCta: string;
};

export const OPS_LANES: OpsLaneConfig[] = [
  {
    id: "support",
    tone: "navy",
    label: "Support lane",
    title: "Shared inbox",
    pathSteps: ["Inbox", "Docs", "Chat", "Handoff"],
    summary:
      "A light inbox for the questions that used to live in email and DMs.",
    bullets: [
      "Shared threads, written like mail",
      "Answers only from your knowledge base, with the source named",
      "Website chat for the repeats",
      "The assistant hands the case to a person with the full thread",
    ],
    icon: ClipboardList,
    demoHref: "/widget",
    demoCta: "Support widget",
    publicHref: "/#try-demo",
    publicCta: "Walk the support steps",
  },
  {
    id: "hiring",
    tone: "navy",
    label: "Hiring lane",
    title: "Hiring shortlist",
    pathSteps: ["Criteria", "Resumes", "Lines", "Compare"],
    summary:
      "Each requirement sits next to the resume line. Shown and Not shown. You decide, unless you turn on auto-reject for a role.",
    bullets: [
      "New, shortlisted, interview, hired — a short set of stages",
      "A missing line is not proof the skill is absent",
      "Compare two or three people on the same requirements",
      "Auto-reject is off unless you turn it on for a role, and it can be undone",
    ],
    icon: UserRoundSearch,
    demoHref: hiringWorkspaceHref(),
    demoCta: "Hiring lane",
    publicHref: SAMPLE_SHORTLIST_HREF,
    publicCta: SAMPLE_SHORTLIST_LABEL,
  },
];

const toneStyles: Record<
  OpsLaneTone,
  {
    panel: string;
    wash: string;
    label: string;
    iconWrap: string;
    step: string;
    connector: string;
    number: string;
    cta: string;
  }
> = {
  navy: {
    panel: "border-primary/15",
    wash: "from-primary-soft/90 via-surface to-surface",
    label: "text-primary",
    iconWrap: "bg-primary text-white shadow-sm shadow-slate-900/25",
    step: "bg-surface text-primary ring-1 ring-primary/15",
    connector: "bg-blue-200",
    number: "text-blue-300",
    cta: "border-primary/20 text-primary hover:border-primary/30 hover:bg-primary-soft",
  },
  teal: {
    panel: "border-accent/30",
    wash: "from-accent-soft via-surface to-surface",
    label: "text-accent",
    iconWrap: "bg-accent text-white shadow-sm shadow-accent/20",
    step: "bg-surface text-accent ring-1 ring-accent/25",
    connector: "bg-accent/30",
    number: "text-accent/40",
    // cn is plain clsx (no tailwind-merge), so these sit next to the secondary
    // variant's border, hover and text classes and lose on CSS order. `!` makes them win.
    cta: "!border-accent/30 !text-accent hover:!border-accent/40 hover:!bg-accent-soft",
  },
};

function PathSteps({
  steps,
  tone,
}: {
  steps: string[];
  tone: OpsLaneTone;
}) {
  const styles = toneStyles[tone];

  return (
    <ol className="mt-6 flex flex-wrap items-center gap-y-2">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center">
          <span
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.02em]",
              styles.step,
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 ? (
            <span
              className={cn("mx-1.5 h-px w-3 shrink-0 sm:w-4", styles.connector)}
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** The lane button: the product page in demo mode, else a public page (never sign-up). */
export function opsLaneCta(lane: OpsLaneConfig, showDemoCta: boolean) {
  return showDemoCta
    ? { href: lane.demoHref, label: lane.demoCta }
    : { href: lane.publicHref, label: lane.publicCta };
}

export function OpsLaneColumn({
  lane,
  showDemoCta = false,
  index = 0,
  className,
}: {
  lane: OpsLaneConfig;
  showDemoCta?: boolean;
  index?: number;
  className?: string;
}) {
  const Icon = lane.icon;
  const styles = toneStyles[lane.tone];
  const { href: ctaHref, label: ctaLabel } = opsLaneCta(lane, showDemoCta);

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-b p-6 sm:p-7",
        styles.panel,
        styles.wash,
        "shadow-card-soft",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute right-5 top-4 select-none text-5xl font-semibold tabular-nums leading-none",
          styles.number,
        )}
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            styles.iconWrap,
          )}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 pr-12">
          <p
            className={cn(
              "text-sm font-medium",
              styles.label,
            )}
          >
            {lane.label}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {lane.title}
          </h3>
        </div>
      </div>

      <PathSteps steps={lane.pathSteps} tone={lane.tone} />

      <p className="mt-5 text-sm leading-6 text-foreground-soft">{lane.summary}</p>

      <ul className="mt-6 flex-1 space-y-3 border-t border-border/70 pt-5">
        {lane.bullets.map((line) => (
          <li
            key={line}
            className="grid grid-cols-[auto_1fr] gap-2.5 text-sm leading-6 text-foreground-soft"
          >
            <span
              className={cn("mt-[9px] h-1 w-1 rounded-full", lane.tone === "teal" ? "bg-accent" : "bg-[var(--primary-hover)]")}
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Link
          href={ctaHref}
          className={buttonClassName({
            variant: "secondary",
            size: "sm",
            className: styles.cta,
          })}
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

export function OpsLanesSection({
  showDemoCta = false,
  className,
}: {
  showDemoCta?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("reveal-stagger grid gap-6 lg:grid-cols-2 lg:gap-8", className)}>
      {OPS_LANES.map((lane, index) => (
        <OpsLaneColumn
          key={lane.id}
          lane={lane}
          showDemoCta={showDemoCta}
          index={index}
        />
      ))}
    </div>
  );
}
