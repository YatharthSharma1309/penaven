import { AlertTriangle, ListChecks, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  escalationCategoryLabel,
  parseEscalationTriage,
  type EscalationTriage,
} from "@/lib/tickets/escalation-triage";
import { publicRunLabel } from "@/lib/execution/storyboard";
import { priorityTone } from "@/lib/tickets/constants";

type EscalationTriageCardProps = {
  triage: unknown;
};

export function EscalationTriageCard({ triage }: EscalationTriageCardProps) {
  const parsed: EscalationTriage | null = parseEscalationTriage(triage);
  if (!parsed) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-primary-soft/50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Operator brief
            </h3>
            <p className="text-xs text-muted">
              AI triage for the human who picks this up
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={priorityTone[parsed.priority]}>
            {parsed.priority.toLowerCase()}
          </Badge>
          <Badge tone="info">{escalationCategoryLabel(parsed.category)}</Badge>
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-xs text-muted">
          Reason code:{" "}
          <span className="font-mono text-foreground">{parsed.reasonCode}</span>
          {parsed.source === "ai" && parsed.model
            ? ` · triaged by ${publicRunLabel(parsed.model)}`
            : " · heuristic triage"}
        </p>

        <ul className="mt-4 space-y-2.5">
          {parsed.brief.map((item, index) => (
            <li
              key={`${index}-${item.slice(0, 24)}`}
              className="flex gap-2 text-sm leading-6 text-foreground"
            >
              <ListChecks className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {parsed.priority === "HIGH" || parsed.priority === "URGENT" ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-warning-ink">
            <AlertTriangle className="h-3.5 w-3.5" />
            Priority needs prompt human attention
          </p>
        ) : null}
      </div>
    </div>
  );
}
