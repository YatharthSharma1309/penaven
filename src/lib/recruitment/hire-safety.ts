import { appConfig } from "@/lib/recruitment/config";
import type { CandidateDTO, CandidateStatus } from "@/lib/recruitment/types";

export const ARCHIVED_STATUS = "archived" as const;
export type ArchivedStatus = typeof ARCHIVED_STATUS;

/** A new hire archives everyone else on the job except these. */
export const KEPT_ON_HIRE_STATUSES = [ARCHIVED_STATUS, "hired"] as const;

export function isArchivedStatus(status: string): status is ArchivedStatus {
  return status === ARCHIVED_STATUS;
}

export function getHireGraceExpiresAt(
  now: Date = new Date(),
  graceMinutes: number = appConfig.hireGraceMinutes
): Date {
  return new Date(now.getTime() + graceMinutes * 60 * 1000);
}

export function isPendingHireExpired(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function getPendingHireRemainingMs(
  expiresAt: Date | string,
  now: Date = new Date()
): number {
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}

export function partitionCandidatesByArchive(candidates: CandidateDTO[]): {
  active: CandidateDTO[];
  archived: CandidateDTO[];
} {
  const active: CandidateDTO[] = [];
  const archived: CandidateDTO[] = [];

  for (const candidate of candidates) {
    if (isArchivedStatus(candidate.status)) {
      archived.push(candidate);
    } else {
      active.push(candidate);
    }
  }

  return { active, archived };
}

export function isRestorableArchivedStatus(
  status: string | null | undefined
): status is CandidateStatus {
  return (
    status === "new" ||
    status === "shortlisted" ||
    status === "interviewing" ||
    status === "rejected" ||
    status === "hired"
  );
}
