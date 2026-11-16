import { cn } from "@/lib/utils";

type ScoreBadgeProps = {
  score: number | null;
  className?: string;
  labeled?: boolean;
};

export const CRITERIA_REVIEW_MEANING =
  "A structured review of how the candidate's available evidence aligns with this job's criteria. This is not a prediction of job performance or a hiring recommendation.";

function scoreTone(score: number): string {
  if (score >= 80) return "bg-success/15 text-success-ink ring-success/30";
  if (score >= 60) return "bg-primary-soft text-primary ring-primary/25";
  if (score >= 40) return "bg-warning/15 text-warning-ink ring-warning/30";
  return "bg-foreground/[0.06] text-muted ring-border";
}

export function ScoreBadge({ score, className, labeled = false }: ScoreBadgeProps) {
  if (score === null) {
    return (
      <span className={cn("inline-flex flex-col items-end gap-0.5", className)}>
        <span
          className="inline-flex items-center rounded-full bg-foreground/[0.04] px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border"
          title="No criteria review yet"
        >
          —
        </span>
        {labeled ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
            Not reviewed
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
          scoreTone(score),
        )}
        title={CRITERIA_REVIEW_MEANING}
        aria-label={`${score} out of 100. ${CRITERIA_REVIEW_MEANING}`}
      >
        {score}
      </span>
      {labeled ? (
        <span className="max-w-36 text-right text-[10px] font-medium uppercase leading-tight tracking-wide text-muted">
          Criteria alignment
        </span>
      ) : null}
    </span>
  );
}
