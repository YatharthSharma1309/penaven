import { db } from "@/lib/db";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import {
  AUTO_REJECT_AUDIT_ACTION,
  AUTO_REJECT_FROM_STATUS,
  AUTO_REJECT_SETTING_AUDIT_ACTION,
  AUTO_REJECT_UNDO_AUDIT_ACTION,
  autoRejectReasons,
  describeAutoRejectReasons,
  type AutoRejectReason,
} from "@/lib/recruitment/auto-reject";
import { RecruitmentError } from "@/lib/recruitment/errors";
import { parseStringArray } from "@/lib/recruitment/json";
import { buildRequirementRows } from "@/lib/recruitment/requirement-rows";
import { toAnalysisDTO, toCandidateDetailDTO } from "@/lib/recruitment/serializers";
import { recordRecruitmentAuditEvent } from "@/lib/recruitment/services/audit";
import type { CandidateDetailDTO } from "@/lib/recruitment/types";

export type AutoRejectOutcome =
  | { rejected: false }
  | { rejected: true; reasons: AutoRejectReason[] };

/**
 * Runs after a screen. Rejects only when the role has auto-reject on, the person
 * is still New, nobody has undone an auto-reject for them, and a must-have was
 * marked Not shown or Contradicts. Never on the public demo. Sends no email.
 */
export async function applyAutoReject(input: {
  organizationId: string;
  candidateId: string;
  actorId: string | null;
}): Promise<AutoRejectOutcome> {
  if (isPublicDemoMode()) return { rejected: false };

  const candidate = await db.candidate.findFirst({
    where: { id: input.candidateId, job: { organizationId: input.organizationId } },
    select: {
      id: true,
      jobId: true,
      displayName: true,
      status: true,
      autoRejectedAt: true,
      autoRejectOverridden: true,
      analysis: true,
      job: { select: { autoRejectEnabled: true, requiredSkills: true } },
    },
  });

  if (
    !candidate?.analysis ||
    !candidate.job.autoRejectEnabled ||
    candidate.status !== AUTO_REJECT_FROM_STATUS ||
    candidate.autoRejectedAt ||
    candidate.autoRejectOverridden
  ) {
    return { rejected: false };
  }

  const requiredSkills = parseStringArray(candidate.job.requiredSkills);
  if (requiredSkills.length === 0) return { rejected: false };

  const rows = buildRequirementRows({
    requiredSkills,
    breakdown: toAnalysisDTO(candidate.analysis).scoreBreakdown,
  });
  const reasons = autoRejectReasons(rows);
  if (reasons.length === 0) return { rejected: false };

  // Guarded on the state just read: a person who moved them in the meantime wins.
  const { count } = await db.candidate.updateMany({
    where: {
      id: candidate.id,
      status: AUTO_REJECT_FROM_STATUS,
      autoRejectedAt: null,
      autoRejectOverridden: false,
      job: { autoRejectEnabled: true },
    },
    data: {
      status: "rejected",
      autoRejectedAt: new Date(),
      autoRejectReason: JSON.stringify(reasons),
      autoRejectPrevious: candidate.status,
    },
  });
  if (count === 0) return { rejected: false };

  await recordRecruitmentAuditEvent({
    organizationId: input.organizationId,
    action: AUTO_REJECT_AUDIT_ACTION,
    entityType: "candidate",
    entityId: candidate.id,
    actorId: input.actorId,
    metadata: {
      jobId: candidate.jobId,
      candidateName: candidate.displayName,
      reasons: describeAutoRejectReasons(reasons),
    },
  });

  return { rejected: true, reasons };
}

/** One click puts the person back where they were, and auto-reject leaves them alone after. */
export async function undoAutoReject(input: {
  organizationId: string;
  candidateId: string;
  actorId: string;
}): Promise<CandidateDetailDTO> {
  const candidate = await db.candidate.findFirst({
    where: { id: input.candidateId, job: { organizationId: input.organizationId } },
    select: {
      id: true,
      jobId: true,
      displayName: true,
      status: true,
      autoRejectedAt: true,
      autoRejectPrevious: true,
    },
  });

  if (!candidate) {
    throw new RecruitmentError("Candidate not found.", 404, "CANDIDATE_NOT_FOUND");
  }
  if (!candidate.autoRejectedAt || candidate.status !== "rejected") {
    throw new RecruitmentError(
      "This person is not auto-rejected any more. Refresh to see their current status.",
      409,
      "NOT_AUTO_REJECTED",
    );
  }

  const restored = candidate.autoRejectPrevious ?? AUTO_REJECT_FROM_STATUS;
  const { count } = await db.candidate.updateMany({
    where: { id: candidate.id, status: "rejected", autoRejectedAt: { not: null } },
    data: {
      status: restored,
      autoRejectedAt: null,
      autoRejectReason: null,
      autoRejectPrevious: null,
      autoRejectOverridden: true,
    },
  });
  if (count === 0) {
    throw new RecruitmentError(
      "Someone changed this person at the same time. Refresh and try again.",
      409,
      "NOT_AUTO_REJECTED",
    );
  }

  await recordRecruitmentAuditEvent({
    organizationId: input.organizationId,
    action: AUTO_REJECT_UNDO_AUDIT_ACTION,
    entityType: "candidate",
    entityId: candidate.id,
    actorId: input.actorId,
    metadata: {
      jobId: candidate.jobId,
      candidateName: candidate.displayName,
      restoredStatus: restored,
    },
  });

  const fresh = await db.candidate.findFirstOrThrow({
    where: { id: candidate.id },
    omit: { fileBytes: true },
    include: { job: true, analysis: true },
  });
  return toCandidateDetailDTO(fresh);
}

export async function setAutoReject(input: {
  organizationId: string;
  jobId: string;
  enabled: boolean;
  actorId: string;
}): Promise<boolean> {
  const { count } = await db.job.updateMany({
    where: { id: input.jobId, organizationId: input.organizationId },
    data: { autoRejectEnabled: input.enabled },
  });
  if (count === 0) return false;

  await recordRecruitmentAuditEvent({
    organizationId: input.organizationId,
    action: AUTO_REJECT_SETTING_AUDIT_ACTION,
    entityType: "job",
    entityId: input.jobId,
    actorId: input.actorId,
    metadata: { enabled: input.enabled },
  });
  return true;
}
