"use client";

import { useState } from "react";
import {
  Bot,
  FileStack,
  FileText,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FounderPainId = "repeat" | "bot-loop" | "hiring-inbox";

export type FounderPainTone = "navy" | "slate" | "teal";

export type FounderPain = {
  id: FounderPainId;
  day: "Mon" | "Wed" | "Fri";
  eyebrow: string;
  title: string;
  body: string;
  chips: string[];
  metric: { label: string; value: string; suffix?: string };
  tone: FounderPainTone;
  icon: LucideIcon;
};

/** Unscreened resumes in the hiring vignette. The metric and the "+N more" row both read it. */
const UNSCREENED_PDF_COUNT = 23;

export const FOUNDER_PAINS: FounderPain[] = [
  {
    id: "repeat",
    day: "Mon",
    eyebrow: "Support · every channel",
    title: "Same answers, every week",
    body: "Returns, passwords, hours, billing — still typed by hand in email and Instagram DMs.",
    chips: ["Email", "Instagram DMs", "Same reply"],
    metric: { label: "Repeat replies", value: "12×", suffix: "this week" },
    tone: "navy",
    icon: RotateCcw,
  },
  {
    id: "bot-loop",
    day: "Wed",
    eyebrow: "Widget · dead end",
    title: "Chatbots that trap people",
    body: "Customers hit loops with no human path. Trust drops; the founder still cleans up.",
    chips: ["FAQ loop", "No escalate", "Trust loss"],
    metric: { label: "Human path", value: "0", suffix: "offered" },
    tone: "slate",
    icon: Bot,
  },
  {
    id: "hiring-inbox",
    day: "Fri",
    eyebrow: "Hiring · second inbox",
    title: "Hiring as a second inbox",
    body: "Indeed and referrals dump PDFs on the founder with no shortlist, rubric, or trail.",
    chips: ["Indeed", "Referrals", "PDF pile"],
    metric: { label: "Unscreened", value: String(UNSCREENED_PDF_COUNT), suffix: "PDFs" },
    tone: "teal",
    icon: FileStack,
  },
];

const toneStyles: Record<
  FounderPainTone,
  {
    gradient: string;
    rail: string;
    label: string;
    dot: string;
    ring: string;
    footer: string;
  }
> = {
  navy: {
    gradient: "from-primary-soft/80",
    rail: "border-primary dark:border-indigo-300",
    label: "text-primary",
    dot: "bg-[var(--primary-hover)]",
    ring: "ring-primary/15",
    footer: "text-primary",
  },
  slate: {
    gradient: "from-foreground/5",
    rail: "border-slate-500",
    label: "text-foreground",
    dot: "bg-slate-500",
    ring: "ring-border",
    footer: "text-muted",
  },
  teal: {
    gradient: "from-accent-soft/80",
    rail: "border-accent",
    label: "text-accent",
    dot: "bg-accent",
    ring: "ring-accent/25",
    footer: "text-accent",
  },
};

type FounderPainsSectionProps = {
  className?: string;
};

export function FounderPainsSection({ className }: FounderPainsSectionProps) {
  const [activeId, setActiveId] = useState<FounderPainId>("repeat");
  const activePain =
    FOUNDER_PAINS.find((pain) => pain.id === activeId) ?? FOUNDER_PAINS[0];
  const activeIndex = FOUNDER_PAINS.findIndex((pain) => pain.id === activeId);

  return (
    <section
      id="problem"
      className={cn(
        "scroll-mt-20 border-b border-border bg-surface",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-foreground">
          What founders deal with every week
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Teams of 5–50 people rarely need a call center. They need fewer
          repeats, a clean handoff, and a hiring inbox that does not eat the
          weekend.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14">
          <InboxShell
            pains={FOUNDER_PAINS}
            activePain={activePain}
            activeIndex={activeIndex}
            onSelect={setActiveId}
          />
          <PainCopyPanel pain={activePain} />
        </div>
      </div>
    </section>
  );
}

function InboxShell({
  pains,
  activePain,
  activeIndex,
  onSelect,
}: {
  pains: FounderPain[];
  activePain: FounderPain;
  activeIndex: number;
  onSelect: (id: FounderPainId) => void;
}) {
  const styles = toneStyles[activePain.tone];

  return (
    <div className="relative w-full animate-fade-up">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent transition-colors duration-300",
            styles.gradient,
          )}
          aria-hidden
        />

        <MetricsStrip pain={activePain} />

        <div className="relative border-b border-border px-3 py-3 sm:px-4">
          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-foreground/[0.06] p-1"
            role="tablist"
            aria-label="Founder pain channels"
          >
            {pains.map((pain) => (
              <PainTab
                key={pain.id}
                pain={pain}
                active={pain.id === activePain.id}
                onClick={() => onSelect(pain.id)}
              />
            ))}
          </div>
          <p className="mt-2.5 text-center text-[11px] font-medium text-muted">
            {activePain.day} · this week’s inbox
          </p>
        </div>

        <div
          className="relative min-h-[240px] px-4 py-5 sm:min-h-[260px] sm:px-5"
          role="tabpanel"
          aria-labelledby={`pain-tab-${activePain.id}`}
        >
          <TimelineSpine activeIndex={activeIndex} />

          <div key={activePain.id} className="relative animate-fade-up pl-0 sm:pl-6">
            {activePain.id === "repeat" ? (
              <RepeatAnswersVignette />
            ) : activePain.id === "bot-loop" ? (
              <BotLoopVignette />
            ) : (
              <HiringPdfVignette />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-foreground/[0.04] px-4 py-2.5 text-[11px] text-muted">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "pain-dot h-1.5 w-1.5 shrink-0 rounded-full hero-demo-pulse",
                styles.dot,
              )}
            />
            <span className="truncate">Founder still owns this</span>
          </span>
          <span className={cn("shrink-0 font-semibold", styles.footer)}>
            {activePain.eyebrow}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricsStrip({ pain }: { pain: FounderPain }) {
  const styles = toneStyles[pain.tone];

  return (
    <div className="relative flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
      <div key={pain.id} className="pain-metric-pop">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          This week
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {pain.metric.value}
          {pain.metric.suffix ? (
            <span className="ml-1.5 text-sm font-medium text-muted">
              {pain.metric.suffix}
            </span>
          ) : null}
        </p>
      </div>
      <span
        className={cn(
          "rounded-lg bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1",
          styles.ring,
        )}
      >
        {pain.metric.label}
      </span>
    </div>
  );
}

function PainTab({
  pain,
  active,
  onClick,
}: {
  pain: FounderPain;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = pain.icon;

  return (
    <button
      type="button"
      id={`pain-tab-${pain.id}`}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:px-2 sm:text-xs",
        active
          ? "bg-surface text-foreground shadow-sm ring-1 ring-foreground/10"
          : "text-muted hover:bg-foreground/[0.05] hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          active ? "text-foreground" : "text-muted",
        )}
      />
      <span className="truncate leading-tight">
        {pain.id === "repeat"
          ? "Repeats"
          : pain.id === "bot-loop"
            ? "Bot loops"
            : "Hiring"}
      </span>
    </button>
  );
}

function TimelineSpine({ activeIndex }: { activeIndex: number }) {
  const positions = ["top-4", "top-1/2 -translate-y-1/2", "bottom-4"];

  return (
    <div className="pointer-events-none absolute inset-y-0 left-6 hidden w-px sm:block">
      <div
        className="absolute inset-y-4 w-px bg-gradient-to-b from-border via-border to-accent/40"
        aria-hidden
      />
      {FOUNDER_PAINS.map((pain, index) => {
        const styles = toneStyles[pain.tone];
        return (
          <span
            key={pain.id}
            className={cn(
              "absolute left-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-surface transition-transform duration-300",
              positions[index],
              index === activeIndex
                ? cn(styles.dot, "scale-125")
                : "scale-90 bg-slate-300",
            )}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

function PainCopyPanel({ pain }: { pain: FounderPain }) {
  const styles = toneStyles[pain.tone];

  return (
    <article
      key={pain.id}
      className={cn(
        "animate-fade-up border-l-[3px] pl-5 sm:pl-6",
        styles.rail,
      )}
      aria-labelledby={`pain-heading-${pain.id}`}
    >
      <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", styles.label)}>
        {pain.eyebrow}
      </p>
      <h3
        id={`pain-heading-${pain.id}`}
        className="mt-2 text-xl font-semibold tracking-tight text-foreground"
      >
        {pain.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted">{pain.body}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {pain.chips.map((chip) => (
          <li
            key={chip}
            className="rounded-lg bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold text-foreground"
          >
            {chip}
          </li>
        ))}
      </ul>
    </article>
  );
}

function RepeatAnswersVignette() {
  const channels = ["Email", "Instagram DM", "Gmail"];
  const messages = [
    { from: "customer", text: "What's your return policy?" },
    { from: "founder", text: "30-day returns on unused items in original packaging.", repeat: 4 },
    { from: "customer", text: "Same question — saw it on Instagram too" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {channels.map((channel) => (
          <span
            key={channel}
            className="rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary"
          >
            {channel}
          </span>
        ))}
      </div>
      {messages.map((message, index) => (
        <div
          key={index}
          className="animate-fade-up"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {message.from === "customer" ? (
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs leading-5 text-white">
              {message.text}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface-raised px-3 py-2">
                <p className="text-xs leading-5 text-foreground">{message.text}</p>
              </div>
              {message.repeat ? (
                <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
                  ×{message.repeat}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BotLoopVignette() {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        Website chatbot
      </p>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs leading-5 text-white">
        I need to talk to someone about a billing error.
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface-raised px-3 py-2 text-xs leading-5 text-foreground">
        Did that help? Choose: Billing FAQ · Password reset · Hours
      </div>
      <div className="mx-auto flex items-center gap-2 py-1 text-[10px] font-semibold text-muted">
        <span className="h-px flex-1 border-t border-dashed border-border" />
        Loop · no human path
        <span className="h-px flex-1 border-t border-dashed border-border" />
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface-raised px-3 py-2 text-xs leading-5 text-foreground">
        Did that help? Choose: Billing FAQ · Password reset · Hours
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="rounded-lg bg-foreground/[0.06] px-2 py-1 text-[10px] text-muted line-through">
          Talk to a person
        </span>
        <span className="rounded-lg bg-foreground/[0.06] px-2 py-1 text-[10px] text-muted line-through">
          Create ticket
        </span>
      </div>
    </div>
  );
}

function HiringPdfVignette() {
  const files = ["Alex_Rivera.pdf", "Jordan_Kim.pdf", "Referral_Resume.pdf"];
  const more = UNSCREENED_PDF_COUNT - files.length;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent/80">
        Inbox · Indeed + referrals
      </p>
      {/* A readable list, not an overlapping pile: every name must stay legible. */}
      <ul className="mt-3 space-y-1.5">
        {files.map((file) => (
          <li
            key={file}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {file}
            </span>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Unread
            </span>
          </li>
        ))}
        {more > 0 ? (
          <li className="rounded-xl border border-dashed border-border px-3 py-1.5 text-center text-[11px] text-muted">
            +{more} more PDFs
          </li>
        ) : null}
      </ul>
      <div className="mt-4 rounded-xl border border-dashed border-accent/30 bg-accent-soft/40 px-3 py-2.5">
        <p className="text-xs font-medium text-accent">Shortlist: empty</p>
        <p className="text-[11px] text-accent/70">
          No rubric · no trail · founder reads every PDF
        </p>
      </div>
    </div>
  );
}
