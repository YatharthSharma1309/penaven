import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { parseStringArray } from "@/lib/recruitment/json";
import {
  candidateStatusLabel,
  evidenceText,
  MOVED_FORWARD_STATUSES,
  shortlistCsv,
  type SharedShortlist,
  type ShortlistCsvRow,
  type ShortlistEvidence,
} from "@/lib/recruitment/shortlist";
import { toAnalysisDTO, toCandidateDTO } from "@/lib/recruitment/serializers";
import type { RequirementRow } from "@/lib/recruitment/types";

function evidenceFromRequirements(requirements: RequirementRow[]): ShortlistEvidence[] {
  return requirements
    .filter(
      (row) =>
        row.verdict !== "not_shown" &&
        row.verdict !== "contradictory" &&
        row.evidence,
    )
    .map((row) => ({ skill: row.skill, quote: row.evidence as string }));
}

export async function ensureShareToken(
  organizationId: string,
  jobId: string,
): Promise<{ token: string; created: boolean } | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true, shareToken: true },
  });
  if (!job) return null;
  if (job.shareToken) return { token: job.shareToken, created: false };

  // Only one parallel caller can fill the empty column. The rest read its token.
  const token = randomBytes(24).toString("base64url");
  const { count } = await db.job.updateMany({
    where: { id: job.id, organizationId, shareToken: null },
    data: { shareToken: token },
  });
  if (count === 1) return { token, created: true };

  const stored = await db.job.findFirst({
    where: { id: job.id, organizationId },
    select: { shareToken: true },
  });
  return stored?.shareToken ? { token: stored.shareToken, created: false } : null;
}

export async function getSharedShortlist(token: string): Promise<SharedShortlist | null> {
  const job = await db.job.findUnique({
    where: { shareToken: token },
    include: {
      candidates: {
        where: { status: { in: [...MOVED_FORWARD_STATUSES] } },
        omit: { fileBytes: true },
        include: { analysis: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) return null;

  const requiredSkills = parseStringArray(job.requiredSkills);

  return {
    clientName: job.clientName,
    title: job.title,
    description: job.description,
    requiredSkills,
    fictional: false,
    candidates: job.candidates.map((candidate) => {
      const dto = toCandidateDTO(candidate, requiredSkills);
      const analysis = candidate.analysis ? toAnalysisDTO(candidate.analysis) : null;
      return {
        displayName: dto.displayName,
        status: candidateStatusLabel(dto.status),
        matchScore: dto.matchScore,
        summary: dto.review?.summary ?? analysis?.summary ?? "",
        evidence: evidenceFromRequirements(dto.review?.requirements ?? []),
        gaps: dto.review?.missingRequiredSkills ?? [],
        interviewQuestions: analysis?.interviewQuestions ?? [],
      };
    }),
  };
}

export async function exportJobCsv(
  organizationId: string,
  jobId: string,
): Promise<{ filename: string; csv: string } | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      candidates: {
        where: { status: { not: "archived" } },
        omit: { fileBytes: true },
        include: { analysis: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) return null;

  const requiredSkills = parseStringArray(job.requiredSkills);
  const rows: ShortlistCsvRow[] = job.candidates.map((candidate) => {
    const dto = toCandidateDTO(candidate, requiredSkills);
    const evidence = evidenceFromRequirements(dto.review?.requirements ?? []);
    return {
      clientName: job.clientName,
      jobTitle: job.title,
      name: dto.displayName,
      status: candidateStatusLabel(dto.status),
      score: dto.matchScore,
      summary: dto.review?.summary ?? "",
      evidence: evidenceText(evidence),
      gaps: (dto.review?.missingRequiredSkills ?? []).join("; "),
      fileName: dto.fileName ?? "",
    };
  });

  const filename = `${job.title.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "shortlist"}.csv`;
  return { filename, csv: shortlistCsv(rows) };
}
