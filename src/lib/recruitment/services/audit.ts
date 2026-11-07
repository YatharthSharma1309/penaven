import { db } from "@/lib/db";
import {
  AUTO_REJECT_AUDIT_ACTION,
  AUTO_REJECT_SETTING_AUDIT_ACTION,
  AUTO_REJECT_UNDO_AUDIT_ACTION,
} from "@/lib/recruitment/auto-reject";

/** One row per finished screen. Screen counts read these, so they outlive the analysis. */
export const RESUME_SCREEN_AUDIT_ACTION = "candidate.analyze";

export type AuditEventDTO = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const actionLabels: Record<string, string> = {
  "job.create": "Job created",
  "job.share": "Shortlist link created",
  "job.update": "Job updated",
  "job.delete": "Job deleted",
  "candidate.create_manual": "Candidate added manually",
  "candidate.upload": "Resume uploaded",
  [RESUME_SCREEN_AUDIT_ACTION]: "AI analysis completed",
  "candidate.update": "Candidate updated",
  "candidate.update_resume": "Resume text updated",
  "candidate.delete": "Candidate deleted",
  "job.archive_candidates_on_hire": "Other candidates archived after hire",
  "hire.undo": "Hire decision undone",
  "hire.finalize": "Archived candidates permanently removed",
  "job.undo_hire": "Hire decision undone",
  "job.finalize_hire": "Archived candidates permanently removed",
  [AUTO_REJECT_AUDIT_ACTION]: "Candidate auto-rejected",
  [AUTO_REJECT_UNDO_AUDIT_ACTION]: "Auto-reject undone",
  [AUTO_REJECT_SETTING_AUDIT_ACTION]: "Auto-reject setting changed",
};

export function formatAuditAction(action: string): string {
  return actionLabels[action] ?? action.replaceAll(".", " ");
}

/** The log line, with the detail the auto-reject entries carry. */
export function describeAuditEvent(event: Pick<AuditEventDTO, "action" | "metadata">): string {
  const metadata = event.metadata ?? {};
  const name = typeof metadata.candidateName === "string" ? metadata.candidateName : null;

  if (event.action === AUTO_REJECT_SETTING_AUDIT_ACTION && typeof metadata.enabled === "boolean") {
    return metadata.enabled ? "Auto-reject turned on" : "Auto-reject turned off";
  }
  if (event.action === AUTO_REJECT_AUDIT_ACTION) {
    const who = name ? `${name} auto-rejected` : "Candidate auto-rejected";
    return typeof metadata.reasons === "string" && metadata.reasons
      ? `${who}. Must-have missing: ${metadata.reasons}`
      : who;
  }
  if (event.action === AUTO_REJECT_UNDO_AUDIT_ACTION && name) {
    return `Auto-reject undone for ${name}`;
  }
  return formatAuditAction(event.action);
}

export async function recordRecruitmentAuditEvent(input: {
  organizationId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await db.recruitmentAuditEvent
    .create({
      data: {
        organizationId: input.organizationId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
    .catch(() => undefined);
}

export async function listJobAuditEvents(
  organizationId: string,
  jobId: string,
  limit = 25
): Promise<AuditEventDTO[]> {
  const events = await db.recruitmentAuditEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const filtered = events
    .filter((event) => {
      if (event.entityId === jobId) return true;
      if (!event.metadata) return false;
      try {
        const metadata = JSON.parse(event.metadata) as Record<string, unknown>;
        return metadata.jobId === jobId;
      } catch {
        return false;
      }
    })
    .slice(0, limit);

  return filtered.map((event) => ({
    id: event.id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    createdAt: event.createdAt.toISOString(),
  }));
}
