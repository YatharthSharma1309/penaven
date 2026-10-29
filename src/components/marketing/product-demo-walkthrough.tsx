"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  FileText,
  MessageSquare,
  Ticket,
  Upload,
} from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DemoStepId =
  | "knowledge"
  | "widget"
  | "escalate"
  | "logs"
  | "hiring";

type DemoStep = {
  id: DemoStepId;
  step: string;
  title: string;
  body: string;
  action: string;
  tip: string;
  href: string;
  cta: string;
};

type ProductDemoWalkthroughProps = {
  demoMode?: boolean;
  className?: string;
};

function buildSteps(demoMode: boolean): DemoStep[] {
  return [
    {
      id: "knowledge",
      step: "01",
      title: "Upload the docs",
      body: "Add the FAQ, refund policy, or hours page customers should be answered from.",
      action: demoMode
        ? "Open Knowledge and load sample data if the document list is empty."
        : "After signup, upload one document from Knowledge.",
      tip: "Start with password, billing, and returns — the questions that fill the inbox.",
      href: demoMode ? "/knowledge" : "/sign-up",
      cta: demoMode ? "Open knowledge" : "Get started free",
    },
    {
      id: "widget",
      step: "02",
      title: "Read the cited answer",
      body: "Ask from the site chat. A covered question names the document. Open the passage under the reply.",
      action: 'Try: "What is the refund policy?"',
      tip: "The line under the answer says whether it came from your docs.",
      href: demoMode ? "/widget" : "/sign-up",
      cta: demoMode ? "Open the site chat" : "Get started free",
    },
    {
      id: "escalate",
      step: "03",
      title: "Hand the thread to a person",
      body: "When the docs do not cover the question, the case keeps the conversation. The team continues from that thread.",
      action: demoMode
        ? "In the site chat, add a follow-up email and ask a person to take it."
        : "From chat, hand the case to a person with the thread attached.",
      tip: "The inbox marks that case Waiting for a human.",
      href: demoMode ? "/inbox" : "/sign-up",
      cta: demoMode ? "Open the inbox" : "Get started free",
    },
    {
      id: "logs",
      step: "04",
      title: "Fill the gap in the docs",
      body: "Questions the docs did not cover are listed. Draft a short page, edit it, and add it.",
      action: "Open Boards, find the unanswered question, and draft the page.",
      tip: "The next reply can use the page you just added.",
      href: demoMode ? "/analytics#knowledge-gaps" : "/sign-up",
      cta: demoMode ? "Open knowledge gaps" : "Get started free",
    },
    {
      id: "hiring",
      step: "05",
      title: "Compare the resume lines",
      body: "When a role opens, read each requirement next to the resume line. A missing line is not proof the skill is absent. You decide.",
      action: demoMode
        ? "Open the sample compare and read Shown and Not shown."
        : "Open a role, upload resumes, and compare the lines.",
      tip: "You still post the role. Penaven holds the evidence.",
      href: demoMode
        ? "/demo/hiring/compare?ids=maya-chen,jordan-ellis"
        : "/sign-up",
      cta: demoMode ? "Open the sample compare" : "Get started free",
    },
  ];
}

export function ProductDemoWalkthrough({
  demoMode = false,
  className,
}: ProductDemoWalkthroughProps) {
  const steps = buildSteps(demoMode);
  const [activeId, setActiveId] = useState<DemoStepId>("knowledge");
  const active = steps.find((step) => step.id === activeId) ?? steps[0];
  const activeIndex = steps.findIndex((step) => step.id === activeId);

  return (
    <section
      id="try-demo"
      className={cn(
        "scroll-mt-20 border-b border-slate-200/80 bg-white",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Interactive demo
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Walk the desk
          </h2>
          <p className="mt-2 text-slate-600">
            Five steps: the docs, a cited answer, a person when it is not
            covered, the page you add next, and a shortlist when a role opens.
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
          <ol className="space-y-2" aria-label="Demo steps">
            {steps.map((step, index) => {
              const selected = step.id === activeId;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(step.id)}
                    aria-current={selected ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200",
                      selected
                        ? "border-primary/20 bg-primary-soft/60 shadow-sm"
                        : "border-transparent bg-foreground/[0.04] hover:border-slate-200 hover:bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        selected
                          ? "bg-primary text-white"
                          : index < activeIndex
                            ? "bg-accent-soft text-accent"
                            : "bg-white text-slate-500 ring-1 ring-slate-200",
                      )}
                    >
                      {step.step}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500 line-clamp-2">
                        {step.body}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-100 bg-gradient-to-b from-primary-soft/70 to-surface px-5 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Step {active.step}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {active.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{active.body}</p>
            </div>

            <div className="border-b border-slate-100 bg-surface px-5 py-5 sm:px-6">
              <StepPreview stepId={active.id} />
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Do this now
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{active.action}</p>
              </div>
              <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">
                Tip: {active.tip}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href={active.href} className={buttonClassName()}>
                  {active.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {activeIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveId(steps[activeIndex + 1].id)}
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                  >
                    Next step
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepPreview({ stepId }: { stepId: DemoStepId }) {
  switch (stepId) {
    case "knowledge":
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Knowledge base
            </p>
            <BookOpen className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mx-3 mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-primary/20 bg-primary-soft/40 px-3 py-4">
            <Upload className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-medium text-slate-700">
              Drop FAQ.md or load sample data
            </p>
          </div>
          <ul className="mt-3 space-y-1.5 px-3 pb-3">
            {["support-faq.txt", "refund-policy.pdf"].map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="truncate text-xs font-medium text-slate-800">
                  {name}
                </span>
                <span className="ml-auto rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Ready
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "widget":
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="ml-2 text-[10px] text-slate-400">yourstore.com</span>
          </div>
          <div className="relative px-3 py-3">
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs leading-5 text-white">
              What is your refund policy?
            </div>
            <div className="mt-2 max-w-[92%] rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-xs leading-5 text-slate-700">
                Annual plans can be refunded within 14 days if usage stays under
                demo limits.
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                <FileText className="h-2.5 w-2.5" />
                support-faq.txt · open the passage
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-accent-soft px-2.5 py-1.5">
              <span className="text-[10px] font-medium text-accent">
                Answered from your docs
              </span>
              <MessageSquare className="h-3.5 w-3.5 text-accent" />
            </div>
          </div>
        </div>
      );
    case "escalate":
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <Ticket className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold text-slate-900">Card failed on renew</p>
            </div>
            <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
              Waiting for a human
            </span>
          </div>
          <div className="space-y-1.5 px-3 py-2.5">
            <div className="ml-4 rounded-md bg-primary-soft px-2 py-1 text-[10px] leading-4 text-primary">
              Customer: Card failed on renew
            </div>
            <div className="mr-4 rounded-lg bg-slate-50 px-2 py-1 text-[10px] leading-4 text-slate-700">
              Not in your docs. A person can take this.
            </div>
          </div>
          <div className="border-t border-primary/15 bg-primary-soft/50 px-3 py-2 text-[10px] font-medium text-primary">
            The conversation stays with the case
          </div>
        </div>
      );
    case "logs":
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Knowledge gaps
            </p>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs font-medium text-slate-800">
              Can I change the billing email?
            </p>
            <p className="mt-1 text-[10px] font-medium text-amber-800">
              Unanswered
            </p>
            <p className="mt-3 rounded-lg bg-primary-soft px-2.5 py-2 text-[10px] font-medium text-primary">
              Draft a page, edit it, then add it
            </p>
          </div>
        </div>
      );
    case "hiring":
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Full-Stack Engineer
            </p>
            <Briefcase className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="space-y-2 px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Maya Chen</p>
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="text-slate-600">React</span>
              <span className="shrink-0 font-medium text-accent">Shown</span>
            </div>
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="text-slate-600">Team leadership</span>
              <span className="shrink-0 font-medium text-rose-700">
                Not shown
              </span>
            </div>
            <p className="pt-1 text-[10px] font-medium text-slate-500">
              You still decide.
            </p>
          </div>
        </div>
      );
  }
}
