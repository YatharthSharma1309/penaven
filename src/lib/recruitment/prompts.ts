import { z } from "zod";
import type { AnalyzeResult, JobAssistResult, JobCriteria } from "@/lib/recruitment/types";

function normalizeUnitScore(value: unknown): unknown {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 1) {
    return value;
  }

  if (value <= 10) {
    return value / 10;
  }

  if (value <= 100) {
    return value / 100;
  }

  return value;
}

function trimToMax(max: number) {
  return (value: unknown): unknown =>
    typeof value === "string" ? value.trim().slice(0, max) : value;
}

/** Models send null for an empty list and run long on single items. */
function normalizeStringList(max: number) {
  return (value: unknown): unknown => {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) return value;
    return value
      .map(trimToMax(max))
      .filter((item) => item !== "" && item !== null)
      .slice(0, 40);
  };
}

function stringListSchema(max: number) {
  return z.preprocess(normalizeStringList(max), z.array(z.string().min(1).max(max)).max(40));
}

function normalizeMatchScore(value: unknown): unknown {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : value;
}

const unitScoreSchema = z.preprocess(normalizeUnitScore, z.number().min(0).max(1));
const concernSchema = z.preprocess(trimToMax(160), z.string().min(1).max(160));
const matchScoreSchema = z.preprocess(
  normalizeMatchScore,
  z.number().int().min(0).max(100)
);

const evidenceMatchSchema = z.object({
  skill: z.string().min(1).max(120),
  evidence: z.string().min(1).max(500),
  confidence: unitScoreSchema,
  matchType: z.enum(["exact", "semantic", "inferred", "contradictory"]),
});

const analyzeEvidenceSchema = z.object({
  matchedRequiredSkills: z.array(evidenceMatchSchema).max(40),
  matchedPreferredSkills: z.array(evidenceMatchSchema).max(40),
  missingRequiredSkills: z.array(z.string().min(1).max(120)).max(40),
  missingPreferredSkills: z.array(z.string().min(1).max(120)).max(40),
  roleAlignment: z.object({
    score: unitScoreSchema,
    evidence: z.string().min(1).max(500),
  }),
  experience: z.object({
    score: unitScoreSchema,
    years: z.number().min(0).max(60).nullable(),
    evidence: z.string().min(1).max(500),
  }),
  educationMatches: z.array(z.string().min(1).max(120)).max(20),
  certificationMatches: z.array(z.string().min(1).max(120)).max(20),
  parseQuality: z.object({
    score: unitScoreSchema,
    concerns: z.array(concernSchema).max(10),
  }),
});

export const analyzeResultSchema = z.object({
  summary: z.string().min(10).max(1200),
  extractedSkills: z.array(z.string()).min(1).max(40),
  matchScore: matchScoreSchema,
  matchRationale: z.string().min(10).max(1500),
  missingSkills: z.array(z.string()).max(30),
  interviewQuestions: z.array(z.string()).min(3).max(10),
  evidence: analyzeEvidenceSchema,
});

export function buildAnalyzePrompt(input: {
  jobTitle: string;
  jobDescription: string;
  criteria: JobCriteria;
  resumeText: string;
}): { system: string; user: string } {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((s) => `- ${s}`).join("\n") : "- None specified";

  const system = `
You are an expert technical recruiter assistant.
Analyze the candidate resume against the job posting and structured criteria.
Rules:
- Ground every skill and claim in the resume text only; do not invent employers, degrees, or tools.
- matchScore is a model estimate from 0-100, but the app calculates the final displayed score separately.
- matchRationale should explain skill evidence and gaps without mentioning a specific percentage.
- missingSkills lists required or strongly implied job skills not evidenced in the resume.
- interviewQuestions must be specific to gaps and the role (5 items).
- Every evidence score and confidence field must be a decimal from 0 to 1, never a percentage or point score. Use 0.8, not 80 or 8.
- parseQuality concerns must be short labels or sentences under 160 characters each.
- Evidence matchType: use exact for literal terms, semantic for equivalent phrasing, inferred only when strongly implied by work evidence. Use contradictory when the resume states the opposite of a requirement, and quote that denial.
- Return ONLY valid JSON matching this shape:
{
  "summary": string,
  "extractedSkills": string[],
  "matchScore": number,
  "matchRationale": string,
  "missingSkills": string[],
  "interviewQuestions": string[],
  "evidence": {
    "matchedRequiredSkills": [{"skill": string, "evidence": string, "confidence": number (0-1), "matchType": "exact" | "semantic" | "inferred" | "contradictory"}],
    "matchedPreferredSkills": [{"skill": string, "evidence": string, "confidence": number (0-1), "matchType": "exact" | "semantic" | "inferred" | "contradictory"}],
    "missingRequiredSkills": string[],
    "missingPreferredSkills": string[],
    "roleAlignment": {"score": number (0-1), "evidence": string},
    "experience": {"score": number (0-1), "years": number | null, "evidence": string},
    "educationMatches": string[],
    "certificationMatches": string[],
    "parseQuality": {"score": number (0-1), "concerns": string[]}
  }
}
`.trim();

  const user = `
Job title: ${input.jobTitle}

Job description:
${input.jobDescription}

Required skills:
${list(input.criteria.requiredSkills)}

Preferred skills:
${list(input.criteria.preferredSkills)}

Experience level: ${input.criteria.experienceLevel ?? "Not specified"}
Minimum years experience: ${input.criteria.minYearsExperience ?? "Not specified"}
Education requirements:
${list(input.criteria.educationRequirements)}

Certifications:
${list(input.criteria.certifications)}

Role type: ${input.criteria.roleType ?? "Not specified"}

Candidate resume text:
${input.resumeText}
`.trim();

  return { system, user };
}

export const jobAssistResultSchema = z.object({
  description: z.string().min(20).max(8000),
  requiredSkills: stringListSchema(80).pipe(z.array(z.string()).min(1)),
  preferredSkills: stringListSchema(120),
  experienceLevel: z.preprocess(trimToMax(80), z.string().min(1).max(80).nullable()),
  minYearsExperience: z.number().int().min(0).max(60).nullable(),
  educationRequirements: stringListSchema(120),
  certifications: stringListSchema(120),
  roleType: z.preprocess(trimToMax(80), z.string().min(1).max(80).nullable()),
});

export function buildJobAssistPrompt(input: {
  title: string;
  description?: string;
}): { system: string; user: string } {
  const system = `
You are an expert recruiter and ATS configuration assistant.
Create an accurate, practical job description and structured scoring criteria from the job title and draft description.
Rules:
- Prefer specific hard skills over generic soft skills.
- Separate required skills from preferred/nice-to-have skills.
- Do not overstate education or certifications unless the title/description strongly implies them.
- Use null when experience level, years, or role type cannot be inferred.
- Use an empty list when education or certifications cannot be inferred.
- Keep each skill to a short name of a few words.
- Return ONLY valid JSON matching this shape:
{
  "description": string,
  "requiredSkills": string[],
  "preferredSkills": string[],
  "experienceLevel": string | null,
  "minYearsExperience": number | null,
  "educationRequirements": string[],
  "certifications": string[],
  "roleType": string | null
}
`.trim();

  const user = `
Job title: ${input.title}

Draft description:
${input.description?.trim() || "No draft provided."}
`.trim();

  return { system, user };
}

function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  try {
    return JSON.parse(jsonBlock) as unknown;
  } catch {
    throw new Error("Model response was not valid JSON.");
  }
}

export function parseAnalyzeResult(raw: string): AnalyzeResult {
  return analyzeResultSchema.parse(parseModelJson(raw));
}

export function parseJobAssistResult(raw: string): JobAssistResult {
  return jobAssistResultSchema.parse(parseModelJson(raw));
}
