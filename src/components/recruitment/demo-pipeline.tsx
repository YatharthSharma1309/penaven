"use client";

import { CandidatePipelineTable } from "@/components/recruitment/candidate-pipeline-table";
import { useDemoHiring } from "@/components/recruitment/demo-hiring-provider";
import { demoCandidateHref, demoCompareHref } from "@/lib/recruitment/demo-sample";
import type { CandidateDTO, CandidateStatus } from "@/lib/recruitment/types";

type DemoPipelineProps = {
  candidates: CandidateDTO[];
  basePath: string;
};

export function DemoSampleSummary({
  candidates,
}: {
  candidates: { id: string; status: CandidateStatus }[];
}) {
  const { statusFor } = useDemoHiring();
  const shortlisted = candidates.filter(
    (candidate) => statusFor(candidate.id, candidate.status) === "shortlisted",
  ).length;

  return (
    <p className="mt-3 text-sm text-slate-500">
      {candidates.length} candidates · {shortlisted} shortlisted
    </p>
  );
}

export function DemoPipeline({ candidates, basePath }: DemoPipelineProps) {
  const { statusFor, setStatus } = useDemoHiring();
  const view = candidates.map((candidate) => ({
    ...candidate,
    status: statusFor(candidate.id, candidate.status),
  }));

  return (
    <CandidatePipelineTable
      jobId="sample-full-stack"
      candidates={view}
      candidateHref={(candidateId) => demoCandidateHref(candidateId, basePath)}
      compareHref={(ids) => demoCompareHref(ids, basePath)}
      onStatusChange={setStatus}
    />
  );
}
