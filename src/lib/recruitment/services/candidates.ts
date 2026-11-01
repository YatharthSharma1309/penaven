import { db } from "@/lib/db";
import { appConfig } from "@/lib/recruitment/config";
import { RecruitmentError } from "@/lib/recruitment/errors";
import {
  displayNameFromFileName,
  extractTextFromBuffer,
  normalizeResumeText,
} from "@/lib/recruitment/parse-resume";
import { toCandidateDetailDTO, toCandidateDTO } from "@/lib/recruitment/serializers";
import { getHireGraceExpiresAt } from "@/lib/recruitment/hire-safety";
import { parseInterviewScorecard } from "@/lib/recruitment/interview-scorecard";
import type { AllowedUploadMime } from "@/lib/recruitment/validators";
import type {
  CandidateDetailDTO,
  CandidateDTO,
  CandidateStatus,
  InterviewScorecard,
} from "@/lib/recruitment/types";

export type UpdateCandidateResult = CandidateDetailDTO & {
  archivedCandidateCount?: number;
  pendingHireExpiresAt?: string;
  prunedCandidateCount?: number;
};

async function getCandidateForOrganization(
  candidateId: string,
  organizationId: string
) {
  return db.candidate.findFirst({
    where: { id: candidateId, job: { organizationId } },
    omit: { fileBytes: true },
    include: { job: true, analysis: true },
  });
}

async function getJobForOrganization(jobId: string, organizationId: string) {
  return db.job.findFirst({
    where: { id: jobId, organizationId },
  });
}

export async function createCandidateFromText(input: {
  organizationId: string;
  jobId: string;
  displayName: string;
  rawText: string;
  parseStatus?: "ok" | "manual";
}): Promise<CandidateDTO> {
  const job = await getJobForOrganization(input.jobId, input.organizationId);
  if (!job) {
    throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const candidate = await db.candidate.create({
    data: {
      jobId: input.jobId,
      displayName: input.displayName,
      rawText: normalizeResumeText(input.rawText),
      parseStatus: input.parseStatus ?? "manual",
      filePath: null,
    },
    omit: { fileBytes: true },
    include: { analysis: true },
  });

  return toCandidateDTO(candidate);
}

export async function createCandidateFromUpload(input: {
  organizationId: string;
  jobId: string;
  fileName: string;
  mimeType: AllowedUploadMime;
  buffer: Buffer;
}): Promise<CandidateDTO> {
  const job = await getJobForOrganization(input.jobId, input.organizationId);
  if (!job) {
    throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  if (input.buffer.byteLength > appConfig.maxUploadBytes) {
    throw new RecruitmentError(
      `File exceeds ${Math.round(appConfig.maxUploadBytes / (1024 * 1024))}MB limit.`,
      413,
      "FILE_TOO_LARGE"
    );
  }

  let rawText = "";
  let parseStatus: "ok" | "failed" = "ok";

  try {
    rawText = (await extractTextFromBuffer(input.buffer, input.mimeType)).replaceAll("\0", "");
    if (rawText.length < 50) {
      parseStatus = "failed";
      rawText = "Could not extract enough text from this file. Paste resume text manually or try another export.";
    }
  } catch {
    parseStatus = "failed";
    rawText =
      "Resume parsing failed. Paste resume text manually on the candidate page or re-upload a text-based PDF/DOCX.";
  }

  const candidate = await db.candidate.create({
    data: {
      jobId: input.jobId,
      displayName: displayNameFromFileName(input.fileName),
      fileName: input.fileName,
      mimeType: input.mimeType,
      filePath: "stored",
      fileBytes: new Uint8Array(input.buffer),
      rawText,
      parseStatus,
    },
    omit: { fileBytes: true },
    include: { analysis: true },
  });

  return toCandidateDTO(candidate);
}

export async function getCandidateDetail(
  organizationId: string,
  candidateId: string
): Promise<CandidateDetailDTO | null> {
  const candidate = await getCandidateForOrganization(candidateId, organizationId);
  if (!candidate) return null;
  return toCandidateDetailDTO(candidate);
}

export async function updateCandidate(input: {
  organizationId: string;
  candidateId: string;
  displayName?: string;
  rawText?: string;
  status?: CandidateStatus;
  notes?: string | null;
  interviewScorecard?: Omit<InterviewScorecard, "updatedAt">;
}): Promise<UpdateCandidateResult> {
  const existing = await getCandidateForOrganization(
    input.candidateId,
    input.organizationId
  );

  if (!existing) {
    throw new RecruitmentError("Candidate not found.", 404, "CANDIDATE_NOT_FOUND");
  }

  const scorecardPayload =
    input.interviewScorecard !== undefined
      ? {
          ...parseInterviewScorecard(input.interviewScorecard),
          updatedAt: new Date().toISOString(),
        }
      : undefined;

  const isHiring =
    input.status === "hired" && existing.status !== "hired";

  let archivedCandidateCount = 0;
  let pendingHireExpiresAt: string | undefined;

  if (isHiring) {
    const job = await db.job.findFirst({
      where: { id: existing.jobId, organizationId: input.organizationId },
      select: { pendingHireCandidateId: true },
    });

    if (
      job?.pendingHireCandidateId &&
      job.pendingHireCandidateId !== input.candidateId
    ) {
      throw new RecruitmentError(
        "Another hire decision is pending for this job. Undo or finalize it before hiring someone else.",
        409,
        "PENDING_HIRE_ACTIVE"
      );
    }

    const candidate = await db.$transaction(async (tx) => {
      const freshJob = await tx.job.findFirst({
        where: { id: existing.jobId, organizationId: input.organizationId },
        select: { pendingHireCandidateId: true },
      });

      if (
        freshJob?.pendingHireCandidateId &&
        freshJob.pendingHireCandidateId !== input.candidateId
      ) {
        throw new RecruitmentError(
          "Another hire decision is pending for this job. Undo or finalize it before hiring someone else.",
          409,
          "PENDING_HIRE_ACTIVE"
        );
      }

      if (input.rawText !== undefined) {
        await tx.candidateAnalysis.deleteMany({
          where: { candidateId: input.candidateId },
        });
      }

      const updated = await tx.candidate.update({
        where: { id: input.candidateId },
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.rawText !== undefined
            ? {
                rawText: normalizeResumeText(input.rawText),
                parseStatus: "manual",
              }
            : {}),
          status: "hired",
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(scorecardPayload !== undefined
            ? { interviewScorecard: scorecardPayload }
            : {}),
        },
        omit: { fileBytes: true },
        include: { analysis: true },
      });

      const others = await tx.candidate.findMany({
        where: {
          jobId: existing.jobId,
          id: { not: input.candidateId },
          status: { not: "archived" },
        },
        omit: { fileBytes: true },
      });

      for (const other of others) {
        await tx.candidate.update({
          where: { id: other.id },
          data: {
            status: "archived",
            statusBeforeArchive: other.status,
          },
        });
      }

      const expiresAt = getHireGraceExpiresAt();
      await tx.job.update({
        where: { id: existing.jobId },
        data: {
          pendingHireCandidateId: input.candidateId,
          pendingHireExpiresAt: expiresAt,
          pendingHirePreviousStatus: existing.status,
        },
      });

      archivedCandidateCount = others.length;
      pendingHireExpiresAt = expiresAt.toISOString();

      return updated;
    });

    return {
      ...toCandidateDetailDTO(candidate),
      archivedCandidateCount,
      pendingHireExpiresAt,
    };
  }

  const candidate = await db.$transaction(async (tx) => {
    if (input.rawText !== undefined) {
      await tx.candidateAnalysis.deleteMany({
        where: { candidateId: input.candidateId },
      });
    }

    return tx.candidate.update({
      where: { id: input.candidateId },
      data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.rawText !== undefined
          ? {
              rawText: normalizeResumeText(input.rawText),
              parseStatus: "manual",
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(scorecardPayload !== undefined
          ? { interviewScorecard: scorecardPayload }
          : {}),
      },
      omit: { fileBytes: true },
      include: { analysis: true },
    });
  });

  return toCandidateDetailDTO(candidate);
}

export const updateCandidateResumeText = updateCandidate;

export async function deleteCandidate(
  organizationId: string,
  candidateId: string
): Promise<boolean> {
  const existing = await getCandidateForOrganization(candidateId, organizationId);
  if (!existing) return false;

  await db.candidate.delete({ where: { id: candidateId } });
  return true;
}

const MAX_COMPARE_CANDIDATES = 3;

/** Load 2–3 candidates for side-by-side compare, preserving requested order. */
export async function getCandidatesForCompare(
  organizationId: string,
  jobId: string,
  candidateIds: string[],
): Promise<CandidateDetailDTO[]> {
  const uniqueIds = [...new Set(candidateIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_COMPARE_CANDIDATES,
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const candidates = await db.candidate.findMany({
    where: {
      id: { in: uniqueIds },
      jobId,
      job: { organizationId },
      status: { not: "archived" },
    },
    omit: { fileBytes: true },
    include: { analysis: true },
  });

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return uniqueIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .map(toCandidateDetailDTO);
}

export async function getCandidateFile(organizationId: string, candidateId: string) {
  const candidate = await db.candidate.findFirst({
    where: {
      id: candidateId,
      job: { organizationId },
      filePath: "stored",
    },
    select: {
      fileBytes: true,
      fileName: true,
      mimeType: true,
    },
  });

  if (!candidate?.fileBytes || !candidate.mimeType) return null;

  return {
    bytes: candidate.fileBytes,
    fileName: candidate.fileName?.trim() || "resume",
    mimeType: candidate.mimeType,
  };
}
