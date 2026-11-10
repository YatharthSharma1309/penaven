"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonClassName } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnalyzeButton } from "@/components/recruitment/analyze-button";
import { CandidateStatusBadge } from "@/components/recruitment/candidate-status-badge";
import {
  describeAutoRejectHeadline,
  describeAutoRejectReasons,
} from "@/lib/recruitment/auto-reject";
import { getPipelineActions } from "@/lib/recruitment/candidate-actions";
import { getStatusChangeConfirmation } from "@/lib/recruitment/pipeline-confirmations";
import type { CandidateDetailDTO, CandidateStatus } from "@/lib/recruitment/types";

type CandidateDetailPanelProps = {
  candidate: CandidateDetailDTO;
  otherCandidateCount: number;
  compareHref?: string | null;
};

export function CandidateDetailPanel({
  candidate,
  otherCandidateCount,
  compareHref = null,
}: CandidateDetailPanelProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [resumeText, setResumeText] = useState(candidate.rawText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsResumeText =
    candidate.parseStatus === "failed" || candidate.rawText.trim().length < 50;

  async function updateCandidate(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/recruitment/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Update failed");
        return false;
      }

      if (body.status === "hired") {
        router.push(`/recruitment/jobs/${candidate.jobId}`);
        return true;
      }

      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(nextStatus: CandidateStatus) {
    const confirmation = getStatusChangeConfirmation({
      nextStatus,
      displayName: candidate.displayName,
      otherCandidateCount,
    });

    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    await updateCandidate({ status: nextStatus });
  }

  async function handleUndoAutoReject() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/recruitment/candidates/${candidate.id}/auto-reject/undo`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Undo failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNotes() {
    await updateCandidate({ notes: notes.trim() || null });
  }

  async function handleSaveResumeText() {
    if (resumeText.trim().length < 50) {
      setError("Paste at least 50 characters of resume text before saving.");
      return;
    }
    await updateCandidate({ rawText: resumeText.trim() });
  }

  const pipelineActions = getPipelineActions(candidate.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <CandidateStatusBadge
          status={candidate.status}
          autoRejected={Boolean(candidate.autoRejection)}
        />
        <AnalyzeButton
          candidateId={candidate.id}
          parseStatus={candidate.parseStatus}
          hasAnalysis={candidate.hasAnalysis}
        />
      </div>

      {candidate.autoRejection ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm">
          <p className="font-medium text-rose-950">Auto-rejected by this role&apos;s rule</p>
          <p className="mt-1 text-rose-900">
            {describeAutoRejectHeadline(candidate.autoRejection.reasons)}:{" "}
            {describeAutoRejectReasons(candidate.autoRejection.reasons) || "see the requirement list"}.
            No email was sent to {candidate.displayName}.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={handleUndoAutoReject}
          >
            Undo auto-reject
          </Button>
        </div>
      ) : null}

      {compareHref || pipelineActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {compareHref ? (
            <Link href={compareHref} className={buttonClassName({ variant: "secondary", size: "sm" })}>
              Compare
            </Link>
          ) : null}
          {pipelineActions.map((action) => (
            <Button
              key={action.nextStatus}
              type="button"
              variant={action.tone === "danger" ? "danger" : action.tone === "secondary" ? "secondary" : "primary"}
              size="sm"
              disabled={busy}
              onClick={() => handleStatusChange(action.nextStatus)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {needsResumeText ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <label htmlFor="candidate-resume-text" className="mb-2 block text-sm font-medium text-amber-950">
            {candidate.parseStatus === "failed"
              ? "This resume could not be read"
              : "Paste resume text"}
          </label>
          <p className="mb-3 text-xs leading-5 text-amber-900/80">
            {candidate.parseStatus === "failed"
              ? "The file did not yield enough text. Paste the resume here and save it, then run analysis. You can also upload the file again from the job page."
              : "Resume text is too short. Paste the resume content here, then run analysis."}
          </p>
          <Textarea
            id="candidate-resume-text"
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            rows={8}
            placeholder="Paste full resume text..."
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={handleSaveResumeText}
          >
            {busy ? "Saving..." : "Save resume text"}
          </Button>
        </div>
      ) : null}

      <div>
        <label htmlFor="candidate-notes" className="mb-2 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <Textarea
          id="candidate-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Interview feedback, follow-up items..."
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={busy}
          onClick={handleSaveNotes}
        >
          {busy ? "Saving..." : "Save notes"}
        </Button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
