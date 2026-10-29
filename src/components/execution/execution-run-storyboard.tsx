import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  MessageSquareWarning,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildExecutionStoryboard,
  publicRunLabel,
  storyboardHeadline,
  type StoryboardLogInput,
  type StoryboardStep,
  type StoryboardTone,
} from "@/lib/execution/storyboard";
import { cn, formatDate } from "@/lib/utils";

type ExecutionRunStoryboardProps = {
  logs: StoryboardLogInput[];
  conversationId?: string | null;
  conversationChannel?: string | null;
  ticketId?: string | null;
  compact?: boolean;
};

const toneToBadge: Record<StoryboardTone, "default" | "success" | "warning" | "danger" | "info"> = {
  neutral: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

const stageIcon = {
  intake: GitBranch,
  retrieve: GitBranch,
  model: Bot,
  outcome: CheckCircle2,
  escalate: Ticket,
} as const;

const railTone: Record<StoryboardTone, string> = {
  neutral: "bg-slate-300",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-blue-800",
};

function StageIcon({ step }: { step: StoryboardStep }) {
  const Icon =
    step.tone === "danger"
      ? CircleAlert
      : step.stage === "escalate"
        ? MessageSquareWarning
        : stageIcon[step.stage];

  return <Icon className="h-4 w-4" />;
}

export function ExecutionRunStoryboard({
  logs,
  conversationId,
  conversationChannel,
  ticketId,
  compact = false,
}: ExecutionRunStoryboardProps) {
  const steps = buildExecutionStoryboard(logs);
  const headline = storyboardHeadline(steps);
  const totalLatency = steps.reduce(
    (sum, step) => sum + (step.latencyMs ?? 0),
    0,
  );
  const primaryModel =
    [...steps].reverse().find((step) => step.model && step.model !== "N/A")
      ?.model ?? "N/A";
  const primaryModelLabel = publicRunLabel(primaryModel);

  const conversationHref =
    conversationId && conversationChannel && conversationChannel !== "ADMIN"
      ? `/inbox/${conversationId}`
      : conversationId
        ? `/chat?conversation=${conversationId}`
        : null;

  const resolvedTicketId =
    ticketId ??
    steps
      .map((step) => step.details.find((d) => d.label === "Ticket")?.value)
      .find(Boolean) ??
    null;

  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-foreground/[0.04] px-4 py-6 text-sm text-slate-500">
        No storyboard steps yet for this run.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Run storyboard
          </p>
          <h3 className="text-lg font-semibold text-slate-900">{headline}</h3>
          <p className="text-sm text-slate-600">
            Retrieve, the reply, and whether it came from the docs or went to a person.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{primaryModelLabel}</Badge>
          <Badge tone="default">{totalLatency} ms total</Badge>
          <Badge tone="default">{steps.length} steps</Badge>
        </div>
      </div>

      {(conversationHref || resolvedTicketId) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {conversationHref ? (
            <Link
              href={conversationHref}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Open conversation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          {resolvedTicketId ? (
            <Link
              href={`/tickets/${resolvedTicketId}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Open ticket #{resolvedTicketId.slice(-6)}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      )}

      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px",
                    railTone[step.tone],
                    "opacity-40",
                  )}
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
                  railTone[step.tone],
                )}
              >
                <StageIcon step={step} />
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Step {index + 1} · {step.stage}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">{step.summary}</p>
                  </div>
                  <Badge tone={toneToBadge[step.tone]}>{publicRunLabel(step.agent)}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="info">{step.model ? publicRunLabel(step.model) : "N/A"}</Badge>
                  <Badge tone="default">
                    {step.latencyMs != null ? `${step.latencyMs} ms` : "latency N/A"}
                  </Badge>
                  {step.decision ? (
                    <Badge tone="default">{publicRunLabel(step.decision)}</Badge>
                  ) : null}
                </div>

                {!compact ? (
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {step.details.slice(0, 6).map((detail) => (
                      <div key={`${step.id}-${detail.label}`}>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {detail.label}
                        </dt>
                        <dd className="mt-0.5 truncate font-mono text-xs text-slate-700">
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {!compact ? (
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(step.createdAt)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
