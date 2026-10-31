"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns2 } from "lucide-react";
import { CandidateStatusBadge } from "@/components/recruitment/candidate-status-badge";
import { rowPrimaryAction } from "@/lib/recruitment/candidate-actions";
import {
  RequirementChecklist,
  RequirementLegend,
} from "@/components/recruitment/requirement-checklist";
import { ScoreBadge } from "@/components/recruitment/score-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import type { CandidateDTO } from "@/lib/recruitment/types";

const MAX_COMPARE = 3;

const STAGES = [
  { status: "new", label: "New" },
  { status: "shortlisted", label: "Shortlisted" },
  { status: "interviewing", label: "Interview" },
  { status: "hired", label: "Hired" },
] as const;

function StageStrip({ candidates }: { candidates: CandidateDTO[] }) {
  const rejected = candidates.filter((candidate) => candidate.status === "rejected").length;

  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((stage) => {
          const count = candidates.filter((candidate) => candidate.status === stage.status).length;
          return (
            <li
              key={stage.status}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <p className="text-xs font-medium text-slate-500">{stage.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{count}</p>
            </li>
          );
        })}
      </ol>
      {rejected > 0 ? (
        <p className="text-xs text-slate-500">
          {rejected} not moving forward
        </p>
      ) : null}
    </div>
  );
}

type CandidatePipelineTableProps = {
  jobId: string;
  candidates: CandidateDTO[];
  candidateHref?: (candidateId: string) => string;
  compareHref?: (candidateIds: string[]) => string;
  onStatusChange?: (candidateId: string, status: CandidateDTO["status"]) => void;
};

export function CandidatePipelineTable({
  jobId,
  candidates,
  candidateHref = (candidateId) =>
    `/recruitment/jobs/${jobId}/candidates/${candidateId}`,
  compareHref = (candidateIds) =>
    `/recruitment/jobs/${jobId}/compare?ids=${encodeURIComponent(candidateIds.join(","))}`,
  onStatusChange,
}: CandidatePipelineTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const analyzedSelected = useMemo(
    () =>
      selectedIds.filter((id) =>
        candidates.some((candidate) => candidate.id === id && candidate.hasAnalysis),
      ),
    [candidates, selectedIds],
  );

  function toggleCandidate(candidateId: string) {
    setSelectedIds((current) => {
      if (current.includes(candidateId)) {
        return current.filter((id) => id !== candidateId);
      }
      if (current.length >= MAX_COMPARE) {
        return current;
      }
      return [...current, candidateId];
    });
  }

  function openCompare() {
    if (analyzedSelected.length < 2) return;
    router.push(compareHref(analyzedSelected.slice(0, MAX_COMPARE)));
  }

  return (
    <div className="space-y-3">
      <StageStrip candidates={candidates} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Ranked by criteria review. Select 2–3 analyzed candidates to compare
          the same requirements.
        </p>
        <Button
          type="button"
          size="sm"
          variant={analyzedSelected.length >= 2 ? "primary" : "secondary"}
          disabled={analyzedSelected.length < 2}
          onClick={openCompare}
        >
          <Columns2 className="h-3.5 w-3.5" />
          Compare
          {analyzedSelected.length > 0 ? ` (${analyzedSelected.length})` : ""}
        </Button>
      </div>
      <RequirementLegend />

      <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {candidates.map((candidate, index) => {
          const checked = selectedIds.includes(candidate.id);
          const disabled =
            !candidate.hasAnalysis || (!checked && selectedIds.length >= MAX_COMPARE);
          const missing = candidate.review?.missingRequiredSkills ?? [];

          return (
            <li key={candidate.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 rounded border-slate-300 text-primary focus-visible:ring-2 focus-visible:ring-primary-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
                  checked={checked}
                  disabled={disabled}
                  aria-label={`Select ${candidate.displayName} for compare`}
                  title={
                    !candidate.hasAnalysis
                      ? "Analyze this candidate before comparing"
                      : undefined
                  }
                  onChange={() => toggleCandidate(candidate.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{index + 1}</p>
                      <Link
                        href={candidateHref(candidate.id)}
                        className="font-medium text-blue-900 hover:text-blue-800"
                      >
                        {candidate.displayName}
                      </Link>
                      {candidate.review?.summary ? (
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {candidate.review.summary}
                        </p>
                      ) : null}
                      {missing.length > 0 ? (
                        <p className="mt-1 text-sm text-slate-600">
                          Needs review: {missing.join(", ")}
                        </p>
                      ) : candidate.review &&
                        candidate.review.requiredCount > 0 &&
                        candidate.review.requirements.every((row) => row.verdict === "shown") ? (
                        <p className="mt-1 text-sm text-accent">
                          Every required skill is quoted in the resume
                        </p>
                      ) : candidate.review && candidate.review.requiredCount > 0 ? (
                        <p className="mt-1 text-sm text-slate-500">
                          Open evidence for inferred or unverified items.
                        </p>
                      ) : null}
                      {candidate.parseStatus === "failed" ? (
                        <p className="mt-1 text-xs text-rose-700">
                          Could not read this resume. Open it to paste the text, or upload the file again.
                        </p>
                      ) : !candidate.hasAnalysis ? (
                        <p className="mt-1 text-xs text-amber-600">Needs analysis</p>
                      ) : null}
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:flex-nowrap sm:items-end">
                      <ScoreBadge score={candidate.matchScore} labeled />
                      <CandidateStatusBadge status={candidate.status} />
                      {onStatusChange && rowPrimaryAction[candidate.status] ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            onStatusChange(
                              candidate.id,
                              rowPrimaryAction[candidate.status]!.nextStatus,
                            )
                          }
                        >
                          {rowPrimaryAction[candidate.status]!.label}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Badge
                      tone={
                        candidate.parseStatus === "ok" || candidate.parseStatus === "manual"
                          ? "success"
                          : candidate.parseStatus === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {candidate.parseStatus === "ok"
                        ? "Read"
                        : candidate.parseStatus === "manual"
                          ? "Added by hand"
                          : candidate.parseStatus === "failed"
                            ? "Could not read"
                            : "Reading"}
                    </Badge>
                    <RelativeTime date={candidate.createdAt} />
                    {candidate.fileName ? <span>{candidate.fileName}</span> : null}
                  </div>
                  {candidate.review && candidate.review.requirements.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-blue-900">
                        Evidence
                      </summary>
                      <div className="mt-2">
                        <RequirementChecklist rows={candidate.review.requirements} legend={false} />
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
