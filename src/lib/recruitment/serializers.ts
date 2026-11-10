import type { Candidate, CandidateAnalysis, Job } from "@/generated/prisma/client";
import { parseAutoRejectReasons } from "@/lib/recruitment/auto-reject";
import {
  orderByMustHaves,
  pickMostMustHavesShown,
} from "@/lib/recruitment/candidate-order";
import { parseJsonObject, parseStringArray } from "@/lib/recruitment/json";
import { isArchivedStatus } from "@/lib/recruitment/hire-safety";
import { parseInterviewScorecard } from "@/lib/recruitment/interview-scorecard";
import {
  buildRequirementRows,
  countAddressedRequirements,
} from "@/lib/recruitment/requirement-rows";
import type {
  AnalysisDTO,
  ActiveCandidateStatus,
  CandidateStats,
  CandidateDetailDTO,
  CandidateDTO,
  CandidateStatus,
  JobDetailDTO,
  JobDTO,
  ParseStatus,
  PendingHireDTO,
  ScoreBreakdown,
} from "@/lib/recruitment/types";

type CandidateWithAnalysis = Omit<Candidate, "fileBytes"> & {
  analysis: CandidateAnalysis | null;
};

const emptyScoreBreakdown: ScoreBreakdown = {
  requiredSkills: 0,
  preferredSkills: 0,
  roleAlignment: 0,
  experience: 0,
  educationCertifications: 0,
  parseQuality: 0,
  penalties: 0,
  matchedRequiredSkills: [],
  matchedPreferredSkills: [],
  missingRequiredSkills: [],
  missingPreferredSkills: [],
  notes: [],
};

export function getCandidateStats(candidates: CandidateWithAnalysis[]): CandidateStats {
  const activeCandidates = candidates.filter(
    (candidate) => !isArchivedStatus(candidate.status)
  );
  const archivedCount = candidates.length - activeCandidates.length;
  const total = candidates.length;
  const resumeReady = activeCandidates.filter(
    (candidate) => candidate.parseStatus === "ok" || candidate.parseStatus === "manual"
  ).length;
  const parseFailed = activeCandidates.filter(
    (candidate) => candidate.parseStatus === "failed"
  ).length;
  const analyzed = activeCandidates.filter((candidate) => Boolean(candidate.analysis)).length;
  const statusCounts: Record<ActiveCandidateStatus, number> = {
    new: 0,
    shortlisted: 0,
    interviewing: 0,
    rejected: 0,
    hired: 0,
  };

  for (const candidate of activeCandidates) {
    const status = candidate.status as ActiveCandidateStatus;
    statusCounts[status] += 1;
  }

  return {
    total,
    activeTotal: activeCandidates.length,
    archivedCount,
    resumeReady,
    parseFailed,
    analyzed,
    pendingAnalysis: Math.max(0, resumeReady - analyzed),
    statusCounts,
  };
}

/**
 * The job card's highlighted candidate: the active person with the most must-haves
 * addressed (then fewer Contradicts, then newest). Not picked by match percentage.
 */
export function getBestCandidate(
  candidates: CandidateWithAnalysis[],
  requiredSkills: string[] = [],
): CandidateDTO | null {
  const activeCandidates = candidates
    .filter((candidate) => !isArchivedStatus(candidate.status) && candidate.analysis)
    .map((candidate) => toCandidateDTO(candidate, requiredSkills));

  return pickMostMustHavesShown(activeCandidates);
}

export function toJobDTO(
  job: Job,
  candidateCount?: number,
  candidateStats?: CandidateStats,
  bestCandidate?: CandidateDTO | null,
  pendingHire?: PendingHireDTO | null
): JobDTO {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    requiredSkills: parseStringArray(job.requiredSkills),
    preferredSkills: parseStringArray(job.preferredSkills),
    experienceLevel: job.experienceLevel || null,
    minYearsExperience: job.minYearsExperience,
    educationRequirements: parseStringArray(job.educationRequirements),
    certifications: parseStringArray(job.certifications),
    roleType: job.roleType || null,
    clientName: job.clientName,
    autoRejectEnabled: job.autoRejectEnabled,
    autoRejectMode: job.autoRejectMode,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    candidateCount,
    candidateStats,
    bestCandidate,
    pendingHire: pendingHire ?? null,
  };
}

export function toCandidateDTO(
  candidate: CandidateWithAnalysis,
  requiredSkills: string[] = [],
): CandidateDTO {
  const analysis = candidate.analysis ? toAnalysisDTO(candidate.analysis) : null;
  const requirements = analysis
    ? buildRequirementRows({
        requiredSkills,
        breakdown: analysis.scoreBreakdown,
      })
    : [];
  const missingRequiredSkills = requirements
    .filter((row) => row.verdict === "not_shown" || row.verdict === "contradictory")
    .map((row) => row.skill);

  return {
    id: candidate.id,
    jobId: candidate.jobId,
    displayName: candidate.displayName,
    fileName: candidate.fileName,
    hasOriginalFile: candidate.filePath === "stored",
    mimeType: candidate.mimeType,
    parseStatus: candidate.parseStatus as ParseStatus,
    status: candidate.status as CandidateStatus,
    notes: candidate.notes,
    createdAt: candidate.createdAt.toISOString(),
    hasAnalysis: Boolean(candidate.analysis),
    matchScore: candidate.analysis?.matchScore ?? null,
    review: analysis
      ? {
          summary: analysis.summary,
          matchRationale: analysis.matchRationale,
          matchedRequiredCount: countAddressedRequirements(requirements),
          requiredCount: requirements.length,
          missingRequiredSkills,
          requirements,
        }
      : null,
    autoRejection:
      candidate.autoRejectedAt && candidate.status === "rejected"
        ? {
            at: candidate.autoRejectedAt.toISOString(),
            reasons: parseAutoRejectReasons(candidate.autoRejectReason),
          }
        : null,
  };
}

export function toAnalysisDTO(analysis: CandidateAnalysis): AnalysisDTO {
  const parsed = parseJsonObject<Partial<ScoreBreakdown>>(
    analysis.scoreBreakdown,
    {},
  );

  return {
    id: analysis.id,
    candidateId: analysis.candidateId,
    summary: analysis.summary,
    extractedSkills: parseStringArray(analysis.extractedSkills),
    matchScore: analysis.matchScore,
    scoreBreakdown: {
      ...emptyScoreBreakdown,
      ...parsed,
      matchedRequiredSkills: parsed.matchedRequiredSkills ?? [],
      matchedPreferredSkills: parsed.matchedPreferredSkills ?? [],
      missingRequiredSkills: parsed.missingRequiredSkills ?? [],
      missingPreferredSkills: parsed.missingPreferredSkills ?? [],
      notes: parsed.notes ?? [],
    },
    matchRationale: analysis.matchRationale,
    missingSkills: parseStringArray(analysis.missingSkills),
    interviewQuestions: parseStringArray(analysis.interviewQuestions),
    analyzedAt: analysis.analyzedAt.toISOString(),
    modelId: analysis.modelId,
  };
}

export function toCandidateDetailDTO(
  candidate: CandidateWithAnalysis & { job?: { requiredSkills: string } },
): CandidateDetailDTO {
  const requiredSkills = candidate.job
    ? parseStringArray(candidate.job.requiredSkills)
    : [];

  return {
    ...toCandidateDTO(candidate, requiredSkills),
    rawText: candidate.rawText,
    analysis: candidate.analysis ? toAnalysisDTO(candidate.analysis) : null,
    interviewScorecard: candidate.interviewScorecard
      ? parseInterviewScorecard(candidate.interviewScorecard)
      : null,
  };
}

export function toJobDetailDTO(
  job: Job,
  candidates: CandidateWithAnalysis[]
): JobDetailDTO {
  const requiredSkills = parseStringArray(job.requiredSkills);

  return {
    ...toJobDTO(
      job,
      candidates.length,
      getCandidateStats(candidates),
      getBestCandidate(candidates, requiredSkills),
    ),
    candidates: orderByMustHaves(
      candidates.map((candidate) => toCandidateDTO(candidate, requiredSkills)),
    ),
  };
}
