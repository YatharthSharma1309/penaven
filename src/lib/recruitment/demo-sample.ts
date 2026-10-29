import { buildRequirementRows, countAddressedRequirements } from "@/lib/recruitment/requirement-rows";
import {
  candidateStatusLabel,
  evidenceText,
  MOVED_FORWARD_STATUSES,
  shortlistCsv,
  type SharedShortlist,
} from "@/lib/recruitment/shortlist";
import type {
  CandidateDetailDTO,
  EvidenceMatch,
  ScoreBreakdown,
} from "@/lib/recruitment/types";

export const DEMO_HIRING_PATH = "/hiring";
export const PUBLIC_DEMO_HIRING_PATH = "/demo/hiring";
export const DEMO_JOB_ID = "sample-full-stack";

export const demoHiringJob = {
  id: DEMO_JOB_ID,
  title: "Full-Stack Engineer",
  clientName: "Harbor & Co.",
  description:
    "Build the customer document workflow: a React and TypeScript product, REST APIs, and document processing. The team deploys on AWS. This posting and every resume on it are fictional.",
  requiredSkills: ["React", "TypeScript", "REST APIs", "AWS", "Team leadership"],
  preferredSkills: ["FastAPI", "Document processing"],
  experienceLevel: "Mid-level",
  minYearsExperience: 3,
  roleType: "Full-time",
} as const;

type DemoCandidateInput = {
  id: string;
  displayName: string;
  fileName: string;
  status: CandidateDetailDTO["status"];
  matchScore: number;
  summary: string;
  matchRationale: string;
  rawText: string;
  interviewQuestions: string[];
  breakdown: ScoreBreakdown;
  extractedSkills: string[];
  createdAt: string;
};

function quote(
  skill: string,
  evidence: string,
  matchType: EvidenceMatch["matchType"] = "exact",
): EvidenceMatch {
  return { skill, evidence, confidence: matchType === "inferred" ? 0.45 : 0.9, matchType };
}

function buildCandidate(input: DemoCandidateInput): CandidateDetailDTO {
  const requirements = buildRequirementRows({
    requiredSkills: [...demoHiringJob.requiredSkills],
    breakdown: input.breakdown,
  });

  return {
    id: input.id,
    jobId: DEMO_JOB_ID,
    displayName: input.displayName,
    fileName: input.fileName,
    hasOriginalFile: false,
    mimeType: "text/plain",
    parseStatus: "ok",
    status: input.status,
    notes: null,
    createdAt: input.createdAt,
    hasAnalysis: true,
    matchScore: input.matchScore,
    rawText: input.rawText,
    interviewScorecard: null,
    review: {
      summary: input.summary,
      matchRationale: input.matchRationale,
      matchedRequiredCount: countAddressedRequirements(requirements),
      requiredCount: requirements.length,
      missingRequiredSkills: requirements
        .filter((row) => row.verdict === "not_shown")
        .map((row) => row.skill),
      requirements,
    },
    analysis: {
      id: `${input.id}-analysis`,
      candidateId: input.id,
      summary: input.summary,
      extractedSkills: input.extractedSkills,
      matchScore: input.matchScore,
      scoreBreakdown: input.breakdown,
      matchRationale: input.matchRationale,
      missingSkills: requirements
        .filter((row) => row.verdict === "not_shown")
        .map((row) => row.skill),
      interviewQuestions: input.interviewQuestions,
      analyzedAt: "2026-10-16T14:00:00.000Z",
      modelId: null,
    },
  };
}

const maya = buildCandidate({
  id: "maya-chen",
  displayName: "Maya Chen",
  fileName: "maya-chen-sample-resume.txt",
  status: "shortlisted",
  matchScore: 91,
  summary:
    "The resume quotes React, TypeScript, REST APIs, and AWS work on a document product. Team leadership is not established.",
  matchRationale:
    "Maya's sample resume shows the product and API work this job asks for, including an AWS deployment. It does not establish experience managing a team.",
  createdAt: "2026-10-15T16:00:00.000Z",
  extractedSkills: ["React", "TypeScript", "REST APIs", "FastAPI", "AWS", "Document processing"],
  rawText: `FICTIONAL SAMPLE RESUME — Maya Chen is not a real person.

Maya Chen
Full-stack engineer

Experience
Northwind Ledger, Product engineer, 2022–2026
Built the customer portal in React.
Typed the portal forms and shared components in TypeScript.
Designed REST APIs consumed by that portal and a partner integration.
Shipped a FastAPI service for the finance intake queue.
Turned PDF invoices into structured records for that queue.
Deployed the intake service on AWS.

Education
B.S. Computer Science, State University
`,
  breakdown: {
    requiredSkills: 40,
    preferredSkills: 15,
    roleAlignment: 10,
    experience: 10,
    educationCertifications: 8,
    parseQuality: 10,
    penalties: 2,
    matchedRequiredSkills: ["React", "TypeScript", "REST APIs", "AWS"],
    matchedPreferredSkills: ["FastAPI", "Document processing"],
    missingRequiredSkills: ["Team leadership"],
    missingPreferredSkills: [],
    requiredSkillEvidence: [
      quote("React", "Built the customer portal in React."),
      quote("TypeScript", "Typed the portal forms and shared components in TypeScript."),
      quote("REST APIs", "Designed REST APIs consumed by that portal and a partner integration."),
      quote("AWS", "Deployed the intake service on AWS."),
    ],
    preferredSkillEvidence: [
      quote("FastAPI", "Shipped a FastAPI service for the finance intake queue."),
      quote("Document processing", "Turned PDF invoices into structured records for that queue."),
    ],
    notes: ["Four years as a product engineer on a document workflow."],
  },
  interviewQuestions: [
    "The resume does not show team leadership. Tell us about a release you coordinated with other people.",
    "Walk through how you deployed the intake service on AWS.",
  ],
});

const jordan = buildCandidate({
  id: "jordan-ellis",
  displayName: "Jordan Ellis",
  fileName: "jordan-ellis-sample-resume.txt",
  status: "new",
  matchScore: 82,
  summary:
    "The resume shows React, TypeScript, FastAPI, and document processing. AWS and team leadership are not established.",
  matchRationale:
    "Jordan's sample resume aligns with the product and API criteria. The cloud platform and team-leadership requirements still need a closer look.",
  createdAt: "2026-10-16T11:30:00.000Z",
  extractedSkills: ["React", "TypeScript", "REST APIs", "FastAPI", "Document processing"],
  rawText: `FICTIONAL SAMPLE RESUME — Jordan Ellis is not a real person.

Jordan Ellis
Software engineer

Experience
Harbor Docs, Software engineer, 2021–2026
Built the customer portal in React for a document workflow product.
Wrote the portal's shared types in TypeScript.
Built REST APIs for invoice intake.
Implemented those invoice endpoints in FastAPI.
Turned PDF invoices into structured records for the billing team.

Education
B.A. Information Systems, Lakeside College
`,
  breakdown: {
    requiredSkills: 30,
    preferredSkills: 15,
    roleAlignment: 8,
    experience: 9,
    educationCertifications: 8,
    parseQuality: 10,
    penalties: 0,
    matchedRequiredSkills: ["React", "TypeScript", "REST APIs"],
    matchedPreferredSkills: ["FastAPI", "Document processing"],
    missingRequiredSkills: ["AWS", "Team leadership"],
    missingPreferredSkills: [],
    requiredSkillEvidence: [
      quote("React", "Built the customer portal in React for a document workflow product."),
      quote("TypeScript", "Wrote the portal's shared types in TypeScript."),
      quote("REST APIs", "Built REST APIs for invoice intake."),
    ],
    preferredSkillEvidence: [
      quote("FastAPI", "Implemented those invoice endpoints in FastAPI."),
      quote("Document processing", "Turned PDF invoices into structured records for the billing team."),
    ],
    notes: [],
  },
  interviewQuestions: [
    "AWS is not established. Where have you deployed a service, and which platform was it?",
    "The resume does not show team leadership. What has leading a small project looked like for you?",
  ],
});

const priya = buildCandidate({
  id: "priya-nair",
  displayName: "Priya Nair",
  fileName: "priya-nair-sample-resume.txt",
  status: "new",
  matchScore: 64,
  summary:
    "The resume quotes React project work. TypeScript, APIs, AWS, and team leadership are not directly established.",
  matchRationale:
    "Priya's sample resume shows frontend project work. Several written requirements still need evidence before a shortlist decision.",
  createdAt: "2026-10-16T09:00:00.000Z",
  extractedSkills: ["React", "JavaScript"],
  rawText: `FICTIONAL SAMPLE RESUME — Priya Nair is not a real person.

Priya Nair
Frontend developer

Experience
Campus Studio, Frontend developer, 2024–2026
Built a course catalog interface in React.
Wrote JavaScript for the catalog and a typed form prototype.

Education
B.S. Design and Computer Science, North College
`,
  breakdown: {
    requiredSkills: 10,
    preferredSkills: 4,
    roleAlignment: 6,
    experience: 6,
    educationCertifications: 8,
    parseQuality: 10,
    penalties: 0,
    matchedRequiredSkills: ["React"],
    matchedPreferredSkills: [],
    missingRequiredSkills: ["TypeScript", "REST APIs", "AWS", "Team leadership"],
    missingPreferredSkills: ["FastAPI", "Document processing"],
    requiredSkillEvidence: [
      quote("React", "Built a course catalog interface in React."),
      quote(
        "TypeScript",
        "Wrote JavaScript for the catalog and a typed form prototype.",
        "inferred",
      ),
    ],
    preferredSkillEvidence: [],
    notes: [],
  },
  interviewQuestions: [
    "The catalog work is described as JavaScript. Where have you shipped TypeScript?",
    "REST APIs are not established. Have you designed or consumed an API another team used?",
  ],
});

export const demoCandidates: CandidateDetailDTO[] = [maya, jordan, priya].sort(
  (a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1),
);

export function getDemoCandidate(candidateId: string) {
  return demoCandidates.find((candidate) => candidate.id === candidateId) ?? null;
}

export function getDemoCandidatesByIds(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 3);
  return unique
    .map((id) => getDemoCandidate(id))
    .filter((candidate): candidate is CandidateDetailDTO => candidate !== null);
}

export function demoCandidateHref(
  candidateId: string,
  basePath = PUBLIC_DEMO_HIRING_PATH,
) {
  return `${basePath}/candidates/${candidateId}`;
}

export function demoCompareHref(ids: string[], basePath = PUBLIC_DEMO_HIRING_PATH) {
  return `${basePath}/compare?ids=${encodeURIComponent(ids.slice(0, 3).join(","))}`;
}

export const DEMO_SHARE_PATH = "/share/sample";
export const DEMO_SHARE_EXPORT_PATH = "/share/sample/export";

function demoEvidence(candidate: CandidateDetailDTO) {
  return (candidate.review?.requirements ?? [])
    .filter(
      (row) =>
        row.verdict !== "not_shown" &&
        row.verdict !== "contradictory" &&
        row.evidence,
    )
    .map((row) => ({ skill: row.skill, quote: row.evidence as string }));
}

export function demoSharedShortlist(): SharedShortlist {
  const movedForward = new Set<string>(MOVED_FORWARD_STATUSES);
  return {
    clientName: demoHiringJob.clientName,
    title: demoHiringJob.title,
    description: demoHiringJob.description,
    requiredSkills: [...demoHiringJob.requiredSkills],
    fictional: true,
    candidates: demoCandidates
      .filter((candidate) => movedForward.has(candidate.status))
      .map((candidate) => ({
        displayName: candidate.displayName,
        status: candidateStatusLabel(candidate.status),
        matchScore: candidate.matchScore,
        summary: candidate.review?.summary ?? "",
        evidence: demoEvidence(candidate),
        gaps: candidate.review?.missingRequiredSkills ?? [],
        interviewQuestions: candidate.analysis?.interviewQuestions ?? [],
      })),
  };
}

export function demoShortlistCsv(): string {
  return shortlistCsv(
    demoCandidates.map((candidate) => ({
      clientName: demoHiringJob.clientName,
      jobTitle: demoHiringJob.title,
      name: candidate.displayName,
      status: candidateStatusLabel(candidate.status),
      score: candidate.matchScore,
      summary: candidate.review?.summary ?? "",
      evidence: evidenceText(demoEvidence(candidate)),
      gaps: (candidate.review?.missingRequiredSkills ?? []).join("; "),
      fileName: candidate.fileName ?? "",
    })),
  );
}
