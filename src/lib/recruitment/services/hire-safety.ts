import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  ARCHIVED_STATUS,
  getHireGraceExpiresAt,
  isPendingHireExpired,
  isRestorableArchivedStatus,
  KEPT_ON_HIRE_STATUSES,
} from "@/lib/recruitment/hire-safety";
import { getPruneCandidateIds } from "@/lib/recruitment/pipeline-confirmations";
import { RecruitmentError } from "@/lib/recruitment/errors";
import type { CandidateStatus } from "@/lib/recruitment/types";

export type PendingHireState = {
  candidateId: string;
  expiresAt: string;
  archivedCount: number;
  hiredDisplayName: string;
};

async function getJobForOrganization(jobId: string, organizationId: string) {
  return db.job.findFirst({
    where: { id: jobId, organizationId },
  });
}

async function deleteResumeFile(filePath: string | null | undefined): Promise<void> {
  void filePath;
  // The original file lives on the candidate row and is removed with that row.
}

async function permanentlyRemoveArchivedCandidates(
  tx: Prisma.TransactionClient,
  jobId: string,
  hiredCandidateId: string
): Promise<number> {
  const archived = await tx.candidate.findMany({
    where: {
      jobId,
      status: ARCHIVED_STATUS,
      id: { not: hiredCandidateId },
    },
    select: { id: true, filePath: true, statusBeforeArchive: true },
  });

  // A hire from before this rule could still be archived. It goes back, never away.
  const earlierHires = archived.filter(
    (candidate) => candidate.statusBeforeArchive === "hired"
  );
  if (earlierHires.length > 0) {
    await tx.candidate.updateMany({
      where: { id: { in: earlierHires.map((candidate) => candidate.id) } },
      data: { status: "hired", statusBeforeArchive: null },
    });
  }

  const removable = archived.filter(
    (candidate) => candidate.statusBeforeArchive !== "hired"
  );
  if (removable.length === 0) return 0;

  const pruneIds = getPruneCandidateIds(
    removable.map((candidate) => candidate.id),
    hiredCandidateId
  );

  await tx.candidate.deleteMany({
    where: { id: { in: pruneIds } },
  });

  await Promise.all(removable.map((candidate) => deleteResumeFile(candidate.filePath)));

  return removable.length;
}

async function restoreArchivedCandidates(
  tx: Prisma.TransactionClient,
  jobId: string,
  pendingCandidateId: string
): Promise<number> {
  const archived = await tx.candidate.findMany({
    where: {
      jobId,
      status: ARCHIVED_STATUS,
      id: { not: pendingCandidateId },
    },
    select: { id: true, statusBeforeArchive: true },
  });

  for (const candidate of archived) {
    await tx.candidate.update({
      where: { id: candidate.id },
      data: {
        status: isRestorableArchivedStatus(candidate.statusBeforeArchive)
          ? candidate.statusBeforeArchive
          : "new",
        statusBeforeArchive: null,
      },
    });
  }

  return archived.length;
}

/**
 * Takes the pending hire off the job. The update locks the job row, so of
 * undo, finalize, and a status change racing each other only one sees true.
 */
async function claimPendingHire(
  tx: Prisma.TransactionClient,
  jobId: string,
  pendingCandidateId: string
): Promise<boolean> {
  const { count } = await tx.job.updateMany({
    where: { id: jobId, pendingHireCandidateId: pendingCandidateId },
    data: {
      pendingHireCandidateId: null,
      pendingHireExpiresAt: null,
      pendingHirePreviousStatus: null,
    },
  });
  return count === 1;
}

/**
 * Backs out a pending hire and restores the archived candidates. Returns how
 * many came back, or null when this candidate was not the pending hire.
 */
export async function releasePendingHire(
  tx: Prisma.TransactionClient,
  jobId: string,
  candidateId: string
): Promise<number | null> {
  if (!(await claimPendingHire(tx, jobId, candidateId))) return null;
  return restoreArchivedCandidates(tx, jobId, candidateId);
}

/**
 * Makes a pending hire permanent. Archived candidates are only removed for a
 * candidate who is really hired; otherwise they are restored and this is null.
 */
async function settlePendingHire(
  tx: Prisma.TransactionClient,
  jobId: string,
  pendingCandidateId: string
): Promise<number | null> {
  if (!(await claimPendingHire(tx, jobId, pendingCandidateId))) return null;

  const hired = await tx.candidate.findFirst({
    where: { id: pendingCandidateId, jobId, status: "hired" },
    select: { id: true },
  });

  if (!hired) {
    await restoreArchivedCandidates(tx, jobId, pendingCandidateId);
    return null;
  }

  return permanentlyRemoveArchivedCandidates(tx, jobId, pendingCandidateId);
}

export async function archiveOtherCandidatesOnHire(
  jobId: string,
  hiredCandidateId: string
): Promise<number> {
  const others = await db.candidate.findMany({
    where: {
      jobId,
      id: { not: hiredCandidateId },
      status: { notIn: [...KEPT_ON_HIRE_STATUSES] },
    },
    omit: { fileBytes: true },
  });

  if (others.length === 0) return 0;

  await db.$transaction(
    others.map((candidate) =>
      db.candidate.update({
        where: { id: candidate.id },
        data: {
          status: ARCHIVED_STATUS,
          statusBeforeArchive: candidate.status,
        },
      })
    )
  );

  return others.length;
}

export async function beginPendingHire(input: {
  organizationId: string;
  jobId: string;
  hiredCandidateId: string;
  previousStatus: CandidateStatus;
}): Promise<{ archivedCount: number; expiresAt: Date }> {
  const job = await getJobForOrganization(input.jobId, input.organizationId);
  if (!job) {
    throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const expiresAt = getHireGraceExpiresAt();
  const archivedCount = await archiveOtherCandidatesOnHire(
    input.jobId,
    input.hiredCandidateId
  );

  await db.job.update({
    where: { id: input.jobId },
    data: {
      pendingHireCandidateId: input.hiredCandidateId,
      pendingHireExpiresAt: expiresAt,
      pendingHirePreviousStatus: input.previousStatus,
    },
  });

  return { archivedCount, expiresAt };
}

export async function getPendingHireState(
  organizationId: string,
  jobId: string
): Promise<PendingHireState | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      candidates: {
        select: {
          id: true,
          displayName: true,
          status: true,
          statusBeforeArchive: true,
        },
      },
    },
  });

  if (!job?.pendingHireCandidateId || !job.pendingHireExpiresAt) {
    return null;
  }

  const hired = job.candidates.find(
    (candidate) => candidate.id === job.pendingHireCandidateId
  );

  if (!hired || hired.status !== "hired") {
    return null;
  }

  const archivedCount = job.candidates.filter(
    (candidate) => candidate.status === ARCHIVED_STATUS
  ).length;

  return {
    candidateId: job.pendingHireCandidateId,
    expiresAt: job.pendingHireExpiresAt.toISOString(),
    archivedCount,
    hiredDisplayName: hired.displayName,
  };
}

export async function undoPendingHire(
  organizationId: string,
  jobId: string
): Promise<{
  restoredCount: number;
  revertedCandidateId: string;
}> {
  const job = await getJobForOrganization(jobId, organizationId);

  if (!job) {
    throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const pendingCandidateId = job.pendingHireCandidateId;

  if (!pendingCandidateId || !job.pendingHireExpiresAt) {
    throw new RecruitmentError("No pending hire decision to undo.", 400, "NO_PENDING_HIRE");
  }

  if (isPendingHireExpired(job.pendingHireExpiresAt)) {
    throw new RecruitmentError(
      "The undo window has expired. Archived candidates are queued for permanent removal.",
      400,
      "HIRE_UNDO_EXPIRED"
    );
  }

  const previousStatus = job.pendingHirePreviousStatus;
  const revertStatus: CandidateStatus = isRestorableArchivedStatus(previousStatus)
    ? previousStatus
    : "interviewing";

  return db.$transaction(async (tx) => {
    const restoredCount = await releasePendingHire(tx, jobId, pendingCandidateId);

    if (restoredCount === null) {
      throw new RecruitmentError("No pending hire decision to undo.", 400, "NO_PENDING_HIRE");
    }

    await tx.candidate.updateMany({
      where: { id: pendingCandidateId, status: "hired" },
      data: { status: revertStatus },
    });

    return { restoredCount, revertedCandidateId: pendingCandidateId };
  });
}

export async function finalizePendingHire(
  organizationId: string,
  jobId: string
): Promise<number> {
  const job = await getJobForOrganization(jobId, organizationId);

  if (!job) {
    throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const pendingCandidateId = job.pendingHireCandidateId;

  if (!pendingCandidateId) {
    throw new RecruitmentError("No pending hire decision to finalize.", 400, "NO_PENDING_HIRE");
  }

  const removedCount = await db.$transaction((tx) =>
    settlePendingHire(tx, jobId, pendingCandidateId)
  );

  if (removedCount === null) {
    throw new RecruitmentError("No pending hire decision to finalize.", 400, "NO_PENDING_HIRE");
  }

  return removedCount;
}

export async function processExpiredPendingHires(options?: {
  jobId?: string;
  organizationId?: string;
}): Promise<number> {
  const now = new Date();
  const jobs = await db.job.findMany({
    where: {
      ...(options?.jobId ? { id: options.jobId } : {}),
      ...(options?.organizationId ? { organizationId: options.organizationId } : {}),
      pendingHireCandidateId: { not: null },
      pendingHireExpiresAt: { lte: now },
    },
    select: {
      id: true,
      pendingHireCandidateId: true,
    },
  });

  let totalRemoved = 0;

  for (const job of jobs) {
    const pendingCandidateId = job.pendingHireCandidateId;
    if (!pendingCandidateId) continue;
    const removedCount = await db.$transaction((tx) =>
      settlePendingHire(tx, job.id, pendingCandidateId)
    );
    totalRemoved += removedCount ?? 0;
  }

  return totalRemoved;
}
