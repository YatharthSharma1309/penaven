import { db } from "@/lib/db";

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
};

export function formatAuditAction(action: string): string {
  return actionLabels[action] ?? action.replaceAll(".", " ");
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
