"use client";

import { useState, type ReactNode } from "react";
import {
  ClipboardList,
  FileText,
  Ticket,
  UserRoundSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Lane = "support" | "hiring";

const SUPPORT = {
  question: "What's your return window on online orders?",
  source: "Refund policy · §2",
  answer:
    "You have 30 days from delivery for unused items in original packaging. Start a return from Orders → Request return.",
  actionHint: "Creates a case with this thread",
};

const HIRING = {
  name: "Maya Chen",
  role: "Full-Stack Engineer",
  lines: [
    { skill: "React", shown: true },
    { skill: "AWS", shown: true },
    { skill: "Team leadership", shown: false },
  ],
  question: "Ask about a release Maya coordinated with other people.",
  action: "Compare with Jordan",
};

/**
 * Static product preview — user switches Support / Hiring tabs.
 * No autoplay (avoids flicker and accidental lane flipping).
 */
export function HeroOpsPreview() {
  const [lane, setLane] = useState<Lane>("support");
  const isSupport = lane === "support";

  return (
    <div className="relative w-full max-w-md animate-fade-up lg:max-w-none">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
            isSupport ? "from-primary-soft/80" : "from-accent-soft/80",
          )}
          aria-hidden
        />

        <div className="relative border-b border-slate-100 px-3 py-3 sm:px-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1"
            role="tablist"
            aria-label="Ops lane preview"
          >
            <LaneChip
              active={isSupport}
              onClick={() => setLane("support")}
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              label="Support"
            />
            <LaneChip
              active={!isSupport}
              onClick={() => setLane("hiring")}
              icon={<UserRoundSearch className="h-3.5 w-3.5" />}
              label="Hiring"
            />
          </div>
          <p className="mt-2.5 text-center text-[11px] font-medium text-muted">
            {isSupport ? "Answered, or a person" : "Lines, then you decide"}
            <span className="mx-1.5 text-slate-300" aria-hidden>
              ·
            </span>
            Click a tab to switch
          </p>
        </div>

        <div
          className="relative px-4 py-4 sm:px-5 sm:py-5"
          role="tabpanel"
          aria-label={isSupport ? "Support lane preview" : "Hiring lane preview"}
        >
          {isSupport ? <SupportPanel /> : <HiringPanel />}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-500">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isSupport ? "bg-[var(--primary-hover)]" : "bg-accent",
              )}
            />
            <span className="truncate">
              {isSupport ? "Answered from your docs" : "Lines beside each requirement"}
            </span>
          </span>
          <span className="shrink-0 font-semibold text-primary">
            {isSupport ? "Support" : "Hiring"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LaneChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
        active
          ? "bg-surface-raised text-primary shadow-sm ring-1 ring-primary/20"
          : "text-muted hover:text-foreground",
      )}
    >
      <span className={active ? "text-primary" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function SupportPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Inbox
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            Return window on online orders
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
          Answered
        </span>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <p className="text-sm leading-6 text-slate-800">{SUPPORT.question}</p>
        <div className="space-y-2 border-l-2 border-primary/30 pl-3">
          <p className="text-sm leading-6 text-slate-700">{SUPPORT.answer}</p>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <FileText className="h-3 w-3" />
            {SUPPORT.source}
          </p>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <p className="text-sm leading-6 text-slate-800">
            Can I change the billing email?
          </p>
          <div className="mt-2 space-y-1.5 border-l-2 border-primary/30 pl-3">
            <p className="text-sm leading-6 text-slate-700">
              Not in your docs. Draft a page from this question.
            </p>
            <p className="text-[11px] font-medium text-muted">Open</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Ticket className="h-3.5 w-3.5 shrink-0" />
            Hand to a person
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {SUPPORT.actionHint}
          </p>
        </div>
      </div>
    </div>
  );
}

function HiringPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-3.5 py-3">
        <p className="text-sm font-semibold text-foreground">{HIRING.name}</p>
        <p className="mt-0.5 text-xs text-muted">{HIRING.role}</p>
      </div>

      <ul className="space-y-1.5 px-3.5 py-3">
        {HIRING.lines.map((line) => (
          <li
            key={line.skill}
            className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2"
          >
            <span className="text-sm text-foreground">{line.skill}</span>
            <span
              className={
                line.shown
                  ? "text-xs font-semibold text-accent"
                  : "text-xs font-semibold text-rose-700"
              }
            >
              {line.shown ? "Shown" : "Not shown"}
            </span>
          </li>
        ))}
      </ul>

      <p className="px-3.5 pb-3 text-sm leading-6 text-muted">{HIRING.question}</p>

      <div className="border-t border-border bg-background px-3.5 py-3">
        <p className="text-sm font-medium text-foreground">{HIRING.action}</p>
        <p className="mt-0.5 text-xs text-muted">You still decide.</p>
      </div>
    </div>
  );
}
