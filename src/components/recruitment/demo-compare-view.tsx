"use client";

import { CandidateCompareGrid } from "@/components/recruitment/candidate-compare-grid";
import { useDemoHiring } from "@/components/recruitment/demo-hiring-provider";
import { demoCandidateHref } from "@/lib/recruitment/demo-sample";
import type { CandidateDetailDTO } from "@/lib/recruitment/types";

type DemoCompareViewProps = {
  requiredSkills: string[];
  candidates: CandidateDetailDTO[];
  basePath: string;
};

export function DemoCompareView({
  requiredSkills,
  candidates,
  basePath,
}: DemoCompareViewProps) {
  const { statusFor } = useDemoHiring();
  const view = candidates.map((candidate) => ({
    ...candidate,
    status: statusFor(candidate.id, candidate.status),
  }));

  return (
    <CandidateCompareGrid
      jobId="sample-full-stack"
      requiredSkills={requiredSkills}
      candidates={view}
      candidateHref={(candidateId) => demoCandidateHref(candidateId, basePath)}
    />
  );
}
