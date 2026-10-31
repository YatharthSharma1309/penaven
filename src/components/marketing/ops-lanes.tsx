import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
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
  },
  {
    id: "hiring",
    tone: "navy",
    label: "Hiring lane",
    title: "Hiring shortlist",
    pathSteps: ["Criteria", "Resumes", "Lines", "Compare"],
    summary:
      "Each requirement sits next to the resume line. Shown and Not shown. You decide.",
    bullets: [
      "New, shortlisted, interview, hired — a short set of stages",
      "A missing line is not proof the skill is absent",
      "Compare two or three people on the same requirements",
      "Nothing is rejected before a person reads it",
    ],
    icon: UserRoundSearch,
    demoHref: hiringWorkspaceHref(),
    demoCta: "Hiring lane",
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

export function OpsLaneColumn({
  lane,
  showDemoCta = false,
  signUpHref = "/sign-up",
  index = 0,
  className,
}: {
  lane: OpsLaneConfig;
  showDemoCta?: boolean;
  signUpHref?: string;
  index?: number;
  className?: string;
}) {
  const Icon = lane.icon;
  const styles = toneStyles[lane.tone];
  const ctaHref = showDemoCta ? lane.demoHref : signUpHref;
  const ctaLabel = showDemoCta ? lane.demoCta : "Get started free";

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-b p-6 sm:p-7",
        styles.panel,
        styles.wash,
        "shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]",
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
              "text-xs font-semibold uppercase tracking-[0.14em]",
              styles.label,
            )}
          >
            {lane.label}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {lane.title}
          </h3>
        </div>
      </div>

      <PathSteps steps={lane.pathSteps} tone={lane.tone} />

      <p className="mt-5 text-sm leading-6 text-slate-600">{lane.summary}</p>

      <ul className="mt-6 flex-1 space-y-3 border-t border-slate-200/70 pt-5">
        {lane.bullets.map((line) => (
          <li
            key={line}
            className="grid grid-cols-[auto_1fr] gap-2.5 text-sm leading-6 text-slate-700"
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
  signUpHref = "/sign-up",
  className,
}: {
  showDemoCta?: boolean;
  signUpHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-2 lg:gap-8", className)}>
      {OPS_LANES.map((lane, index) => (
        <OpsLaneColumn
          key={lane.id}
          lane={lane}
          showDemoCta={showDemoCta}
          signUpHref={signUpHref}
          index={index}
        />
      ))}
    </div>
  );
}
