import Link from "next/link";
import { Briefcase, Users } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import { CandidateStatusBadge } from "@/components/recruitment/candidate-status-badge";
import { ScoreBadge } from "@/components/recruitment/score-badge";
import type { JobDTO } from "@/lib/recruitment/types";

type JobCardProps = {
  job: JobDTO;
};

export function JobCard({ job }: JobCardProps) {
  const candidateCount = job.candidateCount ?? 0;
  const stats = job.candidateStats;

  return (
    <Link href={`/recruitment/jobs/${job.id}`}>
      <Card className="transition hover:border-teal-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Briefcase className="h-4 w-4" />
              </div>
              <CardTitle className="truncate">{job.title}</CardTitle>
            </div>
            {job.clientName ? (
              <p className="mt-2 text-sm font-medium text-foreground">{job.clientName}</p>
            ) : null}
            <CardDescription className="mt-2 line-clamp-2">
              {job.description}
            </CardDescription>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {candidateCount} candidate{candidateCount === 1 ? "" : "s"}
          </span>
          {stats ? (
            <>
              <span>{stats.analyzed} analyzed</span>
              {stats.pendingAnalysis > 0 ? (
                <span className="text-amber-600">{stats.pendingAnalysis} pending</span>
              ) : null}
            </>
          ) : null}
          <RelativeTime date={job.createdAt} className="text-xs text-slate-400" />
        </div>

        {job.bestCandidate ? (
          <div className="mt-4 rounded-xl border border-teal-100 bg-accent-soft/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-accent">Top match</p>
                <p className="font-medium text-slate-900">
                  {job.bestCandidate.displayName}
                </p>
                {job.bestCandidate.review?.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                    {job.bestCandidate.review.summary}
                  </p>
                ) : null}
                {job.bestCandidate.review && job.bestCandidate.review.requiredCount > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {job.bestCandidate.review.matchedRequiredCount} of{" "}
                    {job.bestCandidate.review.requiredCount} required skills
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <ScoreBadge score={job.bestCandidate.matchScore} labeled />
                <CandidateStatusBadge
                  status={job.bestCandidate.status}
                  autoRejected={Boolean(job.bestCandidate.autoRejection)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {job.pendingHire ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            Hire pending for {job.pendingHire.hiredDisplayName}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
