import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Search,
  Ticket,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HowItWorksStep = {
  step: string;
  title: string;
  body: string;
  icon: LucideIcon;
};

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: "01",
    title: "Answer with evidence",
    body: "Connect the FAQs and documents you already have. Customers get answers from that material, with the source they can inspect.",
    icon: BookOpen,
  },
  {
    step: "02",
    title: "Hand off with context",
    body: "When the answer is missing, or a customer needs a person, the ticket keeps the conversation. The team continues without starting over.",
    icon: Ticket,
  },
  {
    step: "03",
    title: "Hire with clarity",
    body: "When a role opens, compare resumes against the requirements. Read the supporting lines, see the gaps, and make the shortlist yourself.",
    icon: Search,
  },
];

type HowItWorksSectionProps = {
  demoMode?: boolean;
  primaryHref?: string;
  secondaryHref?: string;
  className?: string;
};

export function HowItWorksSection({
  demoMode = false,
  primaryHref = "/sign-up",
  secondaryHref = "/help",
  className,
}: HowItWorksSectionProps) {
  return (
    <section
      id="how-it-works"
      className={cn(
        "scroll-mt-20 border-b border-slate-200/80 bg-slate-50",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <header className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-slate-900">How it works</h2>
          <p className="mt-2 text-pretty text-slate-600">
            Three steps. Documentation-grounded answers, a human handoff, and
            an evidence-backed shortlist when a role opens.
          </p>
        </header>

        <PipelineStepper steps={HOW_IT_WORKS_STEPS} className="mt-12 hidden lg:flex" />

        <ol className="mt-10 grid gap-8 lg:mt-8 lg:grid-cols-3 lg:gap-6">
          {HOW_IT_WORKS_STEPS.map((item, index) => (
            <HowItWorksStepCard
              key={item.step}
              item={item}
              index={index}
              isLast={index === HOW_IT_WORKS_STEPS.length - 1}
            />
          ))}
        </ol>

        <div className="mt-12 rounded-2xl border border-slate-200/90 bg-surface px-5 py-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {demoMode
                ? "See the full path in the live demo"
                : "Put your FAQ to work this week"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {demoMode
                ? "Widget → escalate → execution log — no sign-in required."
                : "Upload one doc, put chat on the site, and hand messy threads to a person."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-0 sm:shrink-0">
            {demoMode ? (
              <Link
                href="/#try-demo"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
              >
                Open interactive demo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href={primaryHref}
                  className={buttonClassName()}
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={secondaryHref}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                >
                  Help center
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PipelineStepper({
  steps,
  className,
}: {
  steps: HowItWorksStep[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <div className="absolute left-[calc(16.67%-8px)] right-[calc(16.67%-8px)] top-4 h-px bg-primary/20" />
      <ol className="relative grid grid-cols-3">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.step} className="flex flex-col items-center gap-2">
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-white shadow-sm shadow-slate-900/30 ring-4 ring-slate-50">
                {item.step}
              </span>
              <Icon className="h-4 w-4 text-primary" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HowItWorksStepCard({
  item,
  index,
  isLast,
}: {
  item: HowItWorksStep;
  index: number;
  isLast: boolean;
}) {
  const Icon = item.icon;
  const Mockup =
    index === 0 ? UploadMockup : index === 1 ? TicketMockup : HiringMockup;

  return (
    <li className="relative flex flex-col">
      {!isLast ? (
        <span
          className="absolute left-4 top-10 bottom-0 w-px bg-primary/20 lg:hidden"
          aria-hidden
        />
      ) : null}

      <article className="group flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] transition-shadow duration-200 hover:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-sm font-semibold text-primary ring-1 ring-primary/15 lg:hidden">
              {item.step}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="hidden h-4 w-4 text-primary lg:block" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                  Step {item.step}
                </p>
              </div>
              <h3 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          </div>
        </div>

        <div className="relative flex-1 bg-gradient-to-b from-primary-soft/40 to-surface px-4 py-4 sm:px-5 sm:py-5">
          <Mockup />
        </div>
      </article>
    </li>
  );
}

function UploadMockup() {
  const files = [
    { name: "FAQ.md", size: "12 KB", done: true },
    { name: "refund-policy.pdf", size: "84 KB", done: true },
    { name: "store-hours.txt", size: "2 KB", done: false },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Company memory
        </p>
        <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
          Knowledge base
        </span>
      </div>

      <div className="mx-3 mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-primary/20 bg-primary-soft/30 px-3 py-4">
        <Upload className="h-5 w-5 text-primary" />
        <p className="mt-2 text-xs font-medium text-slate-700">
          Drop FAQ, PDF, or .txt
        </p>
        <p className="text-[10px] text-slate-400">A .txt or PDF is enough</p>
      </div>

      <ul className="mt-3 space-y-1.5 px-3 pb-3">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">
                {file.name}
              </p>
              <p className="text-[10px] text-slate-400">{file.size}</p>
            </div>
            {file.done ? (
              <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                Ready
              </span>
            ) : (
              <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                Reading
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HiringMockup() {
  const rows = [
    ["Python", "Six years on product teams", "Shown"],
    ["FastAPI", "No line in the resume", "Not shown"],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-semibold text-slate-900">Support engineer</p>
        <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/15">
          You decide
        </span>
      </div>
      <table className="w-full text-left">
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-[11px] font-medium text-slate-800">
                {row[0]}
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-600">{row[1]}</td>
              <td className="px-3 py-2 text-right text-[10px] font-semibold text-primary">
                {row[2]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketMockup() {
  const transcript = [
    { role: "customer", text: "Return window on online orders?" },
    { role: "reply", text: "30 days — Refund policy §2." },
    { role: "customer", text: "Item arrived damaged. Not in the docs." },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <Ticket className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-slate-900">Damaged item, need a person</p>
        </div>
        <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
          Waiting for a human
        </span>
      </div>

      <div className="max-h-[7.5rem] space-y-1.5 overflow-hidden px-3 py-2.5">
        {transcript.map((line, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] leading-4",
              line.role === "customer"
                ? "ml-4 bg-primary-soft text-primary"
                : "mr-4 bg-slate-50 text-slate-700",
            )}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-primary/15 bg-primary-soft/50 px-3 py-2">
        <p className="text-[10px] font-medium text-primary">
          The conversation stays with the case
        </p>
      </div>
    </div>
  );
}
