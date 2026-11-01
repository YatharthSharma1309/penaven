import type { Job } from "@/generated/prisma/client";
import { rolesCapped } from "@/lib/billing/usage";
import { db } from "@/lib/db";
import { parseStringArray, stringifyStringArray } from "@/lib/recruitment/json";
import {
  getBestCandidate,
  getCandidateStats,
  toJobDTO,
  toJobDetailDTO,
} from "@/lib/recruitment/serializers";
import {
  getPendingHireState,
  processExpiredPendingHires,
} from "@/lib/recruitment/services/hire-safety";
import type { JobCriteria, JobDetailDTO, JobDTO } from "@/lib/recruitment/types";

type JobInput = JobCriteria & {
  title: string;
  clientName?: string;
  description: string;
};

/** The fields an analysis is scored against. Title and client name are not among them. */
function scoringCriteriaChanged(existing: Job, input: JobInput): boolean {
  const sameList = (stored: string, next: string[]) =>
    JSON.stringify(parseStringArray(stored)) === JSON.stringify(next);

  return !(
    existing.description === input.description &&
    sameList(existing.requiredSkills, input.requiredSkills) &&
    sameList(existing.preferredSkills, input.preferredSkills) &&
    existing.experienceLevel === (input.experienceLevel ?? "") &&
    existing.minYearsExperience === input.minYearsExperience &&
    sameList(existing.educationRequirements, input.educationRequirements) &&
    sameList(existing.certifications, input.certifications) &&
    existing.roleType === (input.roleType ?? "")
  );
}

async function getJobForOrganization(jobId: string, organizationId: string) {
  return db.job.findFirst({
    where: { id: jobId, organizationId },
  });
}

export async function listJobs(organizationId: string): Promise<JobDTO[]> {
  await processExpiredPendingHires({ organizationId });

  const jobs = await db.job.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { candidates: true } },
      candidates: {
        omit: { fileBytes: true },
        include: { analysis: true },
      },
    },
  });

  return Promise.all(
    jobs.map(async (job) => {
      const pendingHire = job.pendingHireCandidateId
        ? await getPendingHireState(organizationId, job.id)
        : null;

      return toJobDTO(
        job,
        job._count.candidates,
        getCandidateStats(job.candidates),
        getBestCandidate(job.candidates, parseStringArray(job.requiredSkills)),
        pendingHire
      );
    })
  );
}

export async function getJobDetail(
  organizationId: string,
  jobId: string
): Promise<JobDetailDTO | null> {
  await processExpiredPendingHires({ jobId, organizationId });

  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      candidates: {
        omit: { fileBytes: true },
        include: { analysis: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) return null;

  const detail = toJobDetailDTO(job, job.candidates);
  const pendingHire = await getPendingHireState(organizationId, jobId);

  return {
    ...detail,
    pendingHire,
  };
}

/**
 * Creates a job unless the workspace is at its role cap, which returns null.
 * The count and the insert run under a per-workspace lock, so parallel requests
 * cannot all pass the cap. Waiting requests each hold a connection, hence the
 * longer timeouts.
 */
export async function createJobWithinCap(
  organizationId: string,
  input: JobInput
): Promise<JobDTO | null> {
  const job = await db.$transaction(
    async (tx) => {
      const lockKey = `role-cap:${organizationId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))`;

      if (await rolesCapped(organizationId, tx)) return null;

      return tx.job.create({
        data: {
          organizationId,
          title: input.title,
          clientName: input.clientName?.trim() ?? "",
          description: input.description,
          requiredSkills: stringifyStringArray(input.requiredSkills),
          preferredSkills: stringifyStringArray(input.preferredSkills),
          experienceLevel: input.experienceLevel ?? "",
          minYearsExperience: input.minYearsExperience,
          educationRequirements: stringifyStringArray(input.educationRequirements),
          certifications: stringifyStringArray(input.certifications),
          roleType: input.roleType ?? "",
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  return job ? toJobDTO(job, 0) : null;
}

export async function updateJob(
  organizationId: string,
  jobId: string,
  input: JobInput
): Promise<JobDTO | null> {
  const existing = await getJobForOrganization(jobId, organizationId);
  if (!existing) return null;

  const clearAnalyses = scoringCriteriaChanged(existing, input);

  const job = await db.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        title: input.title,
        clientName: input.clientName?.trim() ?? "",
        description: input.description,
        requiredSkills: stringifyStringArray(input.requiredSkills),
        preferredSkills: stringifyStringArray(input.preferredSkills),
        experienceLevel: input.experienceLevel ?? "",
        minYearsExperience: input.minYearsExperience,
        educationRequirements: stringifyStringArray(input.educationRequirements),
        certifications: stringifyStringArray(input.certifications),
        roleType: input.roleType ?? "",
      },
    });

    if (clearAnalyses) {
      await tx.candidateAnalysis.deleteMany({
        where: { candidate: { jobId } },
      });
    }

    return updated;
  });

  const candidateCount = await db.candidate.count({ where: { jobId } });
  return toJobDTO(job, candidateCount);
}

export async function deleteJob(
  organizationId: string,
  jobId: string
): Promise<boolean> {
  const existing = await getJobForOrganization(jobId, organizationId);
  if (!existing) return false;
  await db.job.delete({ where: { id: jobId } });
  return true;
}
