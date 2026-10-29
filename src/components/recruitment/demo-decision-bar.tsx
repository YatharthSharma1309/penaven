"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CandidateStatusBadge } from "@/components/recruitment/candidate-status-badge";
import { useDemoHiring } from "@/components/recruitment/demo-hiring-provider";
import { Button, buttonClassName } from "@/components/ui/button";
import { canRejectCandidate } from "@/lib/recruitment/candidate-actions";
import { demoCompareHref } from "@/lib/recruitment/demo-sample";
import type { CandidateStatus } from "@/lib/recruitment/types";

type DemoDecisionBarProps = {
  candidateId: string;
  displayName: string;
  fallbackStatus: CandidateStatus;
  compareIds: string[];
  basePath: string;
};

export function DemoDecisionBar({
  candidateId,
  displayName,
  fallbackStatus,
  compareIds,
  basePath,
}: DemoDecisionBarProps) {
  const { statusFor, setStatus } = useDemoHiring();
  const status = statusFor(candidateId, fallbackStatus);
  const [notice, setNotice] = useState<string | null>(null);
  const compareHref = useMemo(
    () => (compareIds.length >= 2 ? demoCompareHref(compareIds, basePath) : null),
    [compareIds, basePath],
  );

  function applyStatus(nextStatus: CandidateStatus) {
    if (nextStatus === "rejected" && notice !== "Choose Reject again to confirm.") {
      setNotice("Choose Reject again to confirm.");
      return;
    }

    setStatus(candidateId, nextStatus);
    setNotice(`${displayName} is saved in this browser for this visit.`);
  }

  return (
    <div className="space-y-3">
      <CandidateStatusBadge status={status} />
      <div className="flex flex-wrap gap-2">
        {compareHref ? (
          <Link href={compareHref} className={buttonClassName({ size: "sm" })}>
            Compare
          </Link>
        ) : null}
        {status !== "shortlisted" && status !== "rejected" ? (
          <Button type="button" size="sm" onClick={() => applyStatus("shortlisted")}>
            Shortlist
          </Button>
        ) : null}
        {canRejectCandidate(status) ? (
          <Button type="button" size="sm" variant="danger" onClick={() => applyStatus("rejected")}>
            Reject
          </Button>
        ) : null}
        {status === "rejected" ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => applyStatus("new")}>
            Reopen
          </Button>
        ) : null}
      </div>
      {notice ? <p className="text-sm text-slate-600">{notice}</p> : null}
    </div>
  );
}
