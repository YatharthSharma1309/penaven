import type { ReactNode } from "react";

export const CRITERIA_ALIGNMENT_LABEL = "Criteria alignment";

type CandidateCriteriaReviewProps = {
  score: number | null;
  disclaimer: string;
  supporting: string[];
  furtherReview: string[];
  hideSupporting?: boolean;
  actions?: ReactNode;
};

export function CandidateCriteriaReview({
  score,
  disclaimer,
  supporting,
  furtherReview,
  hideSupporting = false,
  actions,
}: CandidateCriteriaReviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">{CRITERIA_ALIGNMENT_LABEL}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          {score === null ? "Not reviewed" : `${score}%`}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{disclaimer}</p>
      </div>

      {hideSupporting ? null : (
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Evidence supporting the match</h3>
        {supporting.length > 0 ? (
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {supporting.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No quoted evidence was found for this job&apos;s criteria.
          </p>
        )}
      </section>
      )}

      {furtherReview.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-slate-900">Areas requiring further review</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {furtherReview.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {actions ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Next action</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Compare, shortlist, or reject.</p>
          <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : null}
    </div>
  );
}
