"use client";

import { startTransition, useRef, useState, ViewTransition } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import escalateDark from "@/assets/walkthrough/escalate-dark.png";
import escalateLight from "@/assets/walkthrough/escalate-light.png";
import hiringDark from "@/assets/walkthrough/hiring-dark.png";
import hiringLight from "@/assets/walkthrough/hiring-light.png";
import knowledgeDark from "@/assets/walkthrough/knowledge-dark.png";
import knowledgeLight from "@/assets/walkthrough/knowledge-light.png";
import logsDark from "@/assets/walkthrough/logs-dark.png";
import logsLight from "@/assets/walkthrough/logs-light.png";
import widgetDark from "@/assets/walkthrough/widget-dark.png";
import widgetLight from "@/assets/walkthrough/widget-light.png";
import { SAMPLE_COMPARE_HREF } from "@/components/marketing/landing-ctas";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DemoStepId =
  | "knowledge"
  | "widget"
  | "escalate"
  | "logs"
  | "hiring";

export type DemoStep = {
  id: DemoStepId;
  step: string;
  title: string;
  body: string;
  action: string;
  tip: string;
  /** Null when the step has no page a visitor can open without an account. */
  href: string | null;
  cta: string | null;
};

type ProductDemoWalkthroughProps = {
  demoMode?: boolean;
  className?: string;
};

/** Shown on support steps when demo mode is off: they need a workspace. */
export const WORKSPACE_ONLY_NOTE =
  "Create a workspace to try this. Step 05 has a public sample you can open now.";

export function buildSteps(demoMode: boolean): DemoStep[] {
  return [
    {
      id: "knowledge",
      step: "01",
      title: "Add the docs",
      body: "Add the FAQ, refund policy, or hours page customers should be answered from.",
      action: demoMode
        ? "Open Knowledge and load sample data if the document list is empty."
        : "After signup, upload one document or import your help pages from Knowledge.",
      tip: "Start with password, billing, and returns — the questions that fill the inbox.",
      href: demoMode ? "/knowledge" : null,
      cta: demoMode ? "Open knowledge" : null,
    },
    {
      id: "widget",
      step: "02",
      title: "Read the cited answer",
      body: "Ask from the site chat. A covered question names the document. Open the passage under the reply.",
      action: 'Try: "What is the refund policy?"',
      tip: "The line under the answer says whether it came from your docs.",
      href: demoMode ? "/widget" : null,
      cta: demoMode ? "Open the site chat" : null,
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
      href: demoMode ? "/inbox" : null,
      cta: demoMode ? "Open the inbox" : null,
    },
    {
      id: "logs",
      step: "04",
      title: "Fill the gap in the docs",
      body: "Questions the docs did not cover are listed. Draft a short page, edit it, and add it.",
      action: "Open Boards, find the unanswered question, and draft the page.",
      tip: "The next reply can use the page you just added.",
      href: demoMode ? "/analytics#knowledge-gaps" : null,
      cta: demoMode ? "Open knowledge gaps" : null,
    },
    {
      id: "hiring",
      step: "05",
      title: "Compare the resume lines",
      body: "When a role opens, read each requirement next to the resume line. A missing line is not proof the skill is absent. You decide.",
      action: demoMode
        ? "Open the sample compare and read Shown and Not shown."
        : "Open the sample compare: fictional resumes, no account needed. Read Shown and Not shown.",
      tip: "You still post the role. Penaven holds the evidence.",
      href: SAMPLE_COMPARE_HREF,
      cta: "Open the sample compare",
    },
  ];
}

export function ProductDemoWalkthrough({
  demoMode = false,
  className,
}: ProductDemoWalkthroughProps) {
  const steps = buildSteps(demoMode);
  const [activeId, setActiveIdNow] = useState<DemoStepId>("knowledge");
  // A transition, so the panel cross-fades through <ViewTransition> where the
  // browser supports view transitions. Elsewhere it simply swaps.
  const setActiveId = (id: DemoStepId) => startTransition(() => setActiveIdNow(id));
  const panelRef = useRef<HTMLDivElement>(null);

  // Below lg the list sits above the panel, so a tap would change content
  // off screen. Bring the panel up to meet it.
  const chooseStep = (id: DemoStepId) => {
    setActiveId(id);
    if (!window.matchMedia("(max-width: 1023.98px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const active = steps.find((step) => step.id === activeId) ?? steps[0];
  const activeIndex = steps.findIndex((step) => step.id === activeId);

  return (
    <section
      id="try-demo"
      className={cn(
        "scroll-mt-20 border-b border-border/80 bg-surface",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <header className="reveal max-w-2xl">
          <h2 className="text-section font-semibold text-foreground">
            Walk the desk
          </h2>
          <p className="mt-2 text-foreground-soft">
            Five steps: the docs, a cited answer, a person when it is not
            covered, the page you add next, and a shortlist when a role opens.
          </p>
        </header>

        <div className="reveal mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
          <ol className="space-y-2" aria-label="Demo steps">
            {steps.map((step, index) => {
              const selected = step.id === activeId;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => chooseStep(step.id)}
                    aria-current={selected ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-200",
                      selected
                        ? "border-primary/20 bg-primary-soft/60 shadow-sm"
                        : "border-transparent bg-foreground/[0.04] hover:border-border hover:bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        selected
                          ? "bg-primary text-white"
                          : index < activeIndex
                            ? "bg-accent-soft text-accent"
                            : "bg-surface text-muted ring-1 ring-border",
                      )}
                    >
                      {step.step}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted line-clamp-2">
                        {step.body}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <ViewTransition default="walkthrough-swap">
          <div
            ref={panelRef}
            className="scroll-mt-24 overflow-hidden rounded-2xl border border-border/90 bg-surface shadow-card"
          >
            <div className="border-b border-hairline bg-gradient-to-b from-primary-soft/70 to-surface px-5 py-5 sm:px-6">
              <p className="text-sm font-medium text-primary">
                Step {active.step}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {active.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-soft">{active.body}</p>
            </div>

            <div className="border-b border-hairline bg-surface-sunken px-4 py-5 sm:px-6">
              <StepShot stepId={active.id} />
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div>
                <p className="text-sm font-medium text-foreground-soft">
                  Do this now
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground-soft">{active.action}</p>
              </div>
              <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">
                Tip: {active.tip}
              </p>
              {active.href ? null : (
                <p className="text-sm leading-6 text-foreground-soft">
                  {WORKSPACE_ONLY_NOTE}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {active.href && active.cta ? (
                  <Link href={active.href} className={buttonClassName()}>
                    {active.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveId("hiring")}
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    Go to the sample (step 05)
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {activeIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveId(steps[activeIndex + 1].id)}
                    className="text-sm font-medium text-foreground-soft transition-colors hover:text-primary"
                  >
                    Next step
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          </ViewTransition>
        </div>
      </div>
    </section>
  );
}

type StepShotImage = {
  light: StaticImageData;
  dark: StaticImageData;
  path: string;
  alt: string;
};

/**
 * Screenshots of the demo workspace, cropped to the card each step is about.
 * Recapture with `node scripts/capture-walkthrough-shots.mjs` when those screens change.
 */
const STEP_SHOTS: Record<DemoStepId, StepShotImage> = {
  knowledge: {
    light: knowledgeLight,
    dark: knowledgeDark,
    path: "/knowledge",
    alt: "The Knowledge page listing support-faq.txt as Ready, so the next reply can use it.",
  },
  widget: {
    light: widgetLight,
    dark: widgetDark,
    path: "/inbox",
    alt: "A customer asks how to reset a password. The reply gives the steps, says Answered from your docs, and names support-faq as the source.",
  },
  escalate: {
    light: escalateLight,
    dark: escalateDark,
    path: "/inbox",
    alt: "The inbox: one conversation Answered, two Open, and an API rate limits thread Waiting for a human with an open case.",
  },
  logs: {
    light: logsLight,
    dark: logsDark,
    path: "/analytics",
    alt: "Knowledge gaps: a question about API rate limits marked wrong, with a Draft a page button.",
  },
  hiring: {
    light: hiringLight,
    dark: hiringDark,
    path: "/hiring/compare",
    alt: "Maya Chen and Jordan Ellis side by side. Each requirement shows the resume line, marked Shown or Not shown.",
  },
};

const SHOT_SIZES = "(min-width: 1024px) 34rem, (min-width: 640px) 36rem, 100vw";

function StepShot({ stepId }: { stepId: DemoStepId }) {
  const shot = STEP_SHOTS[stepId];
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface shadow-card-soft">
      <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{shot.path}</span>
      </div>
      {/* The .dark class picks the image, like the rest of the theme. A lazy
          image that is display:none is not fetched, so each visitor loads one. */}
      <Image
        src={shot.light}
        alt={shot.alt}
        sizes={SHOT_SIZES}
        placeholder="blur"
        className="block h-auto w-full dark:hidden"
      />
      <Image
        src={shot.dark}
        alt={shot.alt}
        sizes={SHOT_SIZES}
        placeholder="blur"
        className="hidden h-auto w-full dark:block"
      />
    </figure>
  );
}
