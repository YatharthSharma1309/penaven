import Link from "next/link";
import { CandidateStatusBadge } from "@/components/recruitment/candidate-status-badge";
import {
  RequirementChecklist,
  RequirementLegend,
} from "@/components/recruitment/requirement-checklist";
import { ScoreBadge } from "@/components/recruitment/score-badge";
import { Card } from "@/components/ui/card";
import { buildRequirementRows, resumeExcerpt } from "@/lib/recruitment/requirement-rows";
import type { CandidateDetailDTO } from "@/lib/recruitment/types";
import { cn } from "@/lib/utils";

type CandidateCompareGridProps = {
  jobId: string;
  requiredSkills: string[];
  candidates: CandidateDetailDTO[];
  candidateHref?: (candidateId: string) => string;
};

export function CandidateCompareGrid({
  jobId,
  requiredSkills,
  candidates,
  candidateHref = (candidateId) =>
    `/recruitment/jobs/${jobId}/candidates/${candidateId}`,
}: CandidateCompareGridProps) {
  return (
    <div className="space-y-4">
    <div
      className={cn(
        "grid gap-4",
        candidates.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3",
      )}
    >
      {candidates.map((candidate) => {
        const analysis = candidate.analysis;
        const rows = analysis
          ? buildRequirementRows({
              requiredSkills,
              breakdown: analysis.scoreBreakdown,
            })
          : [];
        return (
          <Card key={candidate.id} className="flex flex-col gap-4">
            <div className="min-w-0">
              <Link
                href={candidateHref(candidate.id)}
                className="text-base font-semibold text-primary hover:underline"
              >
                {candidate.displayName}
              </Link>
              <div className="mt-2">
                <CandidateStatusBadge status={candidate.status} />
              </div>
            </div>

            {analysis ? (
              <>
                <p className="text-sm leading-6 text-slate-800">
                  {analysis.matchRationale}
                </p>

                {rows.length > 0 ? (
                  <RequirementChecklist rows={rows} legend={false} />
                ) : null}

                {analysis.interviewQuestions.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Questions to ask
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {analysis.interviewQuestions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {candidate.rawText ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Resume excerpt
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {resumeExcerpt(candidate.rawText)}
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-xs text-muted">
                    Criteria alignment, after the lines above. You still decide.
                  </p>
                  <ScoreBadge score={candidate.matchScore} labeled />
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-700">
                This candidate has not been analyzed yet.
              </p>
            )}
          </Card>
        );
      })}
    </div>
    <RequirementLegend />
    </div>
  );
}
