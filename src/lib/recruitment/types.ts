export type ParseStatus = "ok" | "failed" | "manual";
export type CandidateStatus =
  | "new"
  | "shortlisted"
  | "interviewing"
  | "rejected"
  | "hired"
  | "archived";

export type JobCriteria = {
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string | null;
  minYearsExperience: number | null;
  educationRequirements: string[];
  certifications: string[];
  roleType: string | null;
};

export type ScoreBreakdown = {
  requiredSkills: number;
  preferredSkills: number;
  roleAlignment: number;
  experience: number;
  educationCertifications: number;
  parseQuality: number;
  penalties: number;
  matchedRequiredSkills: string[];
  matchedPreferredSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  requiredSkillEvidence?: EvidenceMatch[];
  preferredSkillEvidence?: EvidenceMatch[];
  notes: string[];
};

export type ActiveCandidateStatus = Exclude<CandidateStatus, "archived">;

export type CandidateStats = {
  total: number;
  activeTotal: number;
  archivedCount: number;
  resumeReady: number;
  parseFailed: number;
  analyzed: number;
  pendingAnalysis: number;
  statusCounts: Record<ActiveCandidateStatus, number>;
};

export type PendingHireDTO = {
  candidateId: string;
  expiresAt: string;
  archivedCount: number;
  hiredDisplayName: string;
};

export type JobDTO = {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string | null;
  minYearsExperience: number | null;
  educationRequirements: string[];
  certifications: string[];
  roleType: string | null;
  clientName: string;
  /** Off until a person turns it on for this role. */
  autoRejectEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
  candidateStats?: CandidateStats;
  bestCandidate?: CandidateDTO | null;
  pendingHire?: PendingHireDTO | null;
};

export type CandidateDTO = {
  id: string;
  jobId: string;
  displayName: string;
  fileName: string | null;
  hasOriginalFile: boolean;
  mimeType: string | null;
  parseStatus: ParseStatus;
  status: CandidateStatus;
  notes: string | null;
  createdAt: string;
  hasAnalysis: boolean;
  matchScore: number | null;
  review: CandidateReview | null;
  /** Set while the person is rejected by the role's auto-reject and nobody has undone it. */
  autoRejection: AutoRejectionDTO | null;
};

export type AutoRejectionDTO = {
  at: string;
  reasons: Array<{ skill: string; verdict: "not_shown" | "contradictory" }>;
};

export type InterviewRecommendation = "strong_yes" | "yes" | "maybe" | "no";

export type InterviewSkillScore = {
  skill: string;
  score: number | null;
  notes: string;
};

export type InterviewQuestionScore = {
  question: string;
  asked: boolean;
  score: number | null;
  notes: string;
};

export type InterviewScorecard = {
  skillScores: InterviewSkillScore[];
  questionScores: InterviewQuestionScore[];
  overallNotes: string;
  recommendation: InterviewRecommendation | null;
  updatedAt: string | null;
};

export type AnalysisDTO = {
  id: string;
  candidateId: string;
  summary: string;
  extractedSkills: string[];
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
  matchRationale: string;
  missingSkills: string[];
  interviewQuestions: string[];
  analyzedAt: string;
  modelId: string | null;
};

export type CandidateDetailDTO = CandidateDTO & {
  rawText: string;
  analysis: AnalysisDTO | null;
  interviewScorecard: InterviewScorecard | null;
};

export type JobDetailDTO = JobDTO & {
  candidates: CandidateDTO[];
  pendingHire?: PendingHireDTO | null;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
};

export type AnalyzeResult = {
  summary: string;
  extractedSkills: string[];
  matchScore: number;
  matchRationale: string;
  missingSkills: string[];
  interviewQuestions: string[];
  evidence: AnalyzeEvidence;
};

export type AnalyzeEvidence = {
  matchedRequiredSkills: EvidenceMatch[];
  matchedPreferredSkills: EvidenceMatch[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  roleAlignment: {
    score: number;
    evidence: string;
  };
  experience: {
    score: number;
    years: number | null;
    evidence: string;
  };
  educationMatches: string[];
  certificationMatches: string[];
  parseQuality: {
    score: number;
    concerns: string[];
  };
};

export type EvidenceMatch = {
  skill: string;
  evidence: string;
  confidence: number;
  matchType: "exact" | "semantic" | "inferred" | "contradictory";
};

export type RequirementVerdict =
  | "shown"
  | "inferred"
  | "unverified"
  | "not_shown"
  | "contradictory";

export type RequirementRow = {
  skill: string;
  verdict: RequirementVerdict;
  evidence: string | null;
};

export type CandidateReview = {
  summary: string;
  matchRationale: string;
  matchedRequiredCount: number;
  requiredCount: number;
  missingRequiredSkills: string[];
  requirements: RequirementRow[];
};

export type JobAssistResult = {
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string | null;
  minYearsExperience: number | null;
  educationRequirements: string[];
  certifications: string[];
  roleType: string | null;
};
