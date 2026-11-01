import type { CandidateStatus } from "@/lib/recruitment/types";

export const MOVED_FORWARD_STATUSES = ["shortlisted", "interviewing", "hired"] as const;

const statusLabels: Record<CandidateStatus, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  interviewing: "Interview",
  rejected: "Not moving forward",
  hired: "Hired",
  archived: "Archived",
};

export function candidateStatusLabel(status: string): string {
  if (status in statusLabels) {
    return statusLabels[status as CandidateStatus];
  }
  return status;
}

export type ShortlistEvidence = {
  skill: string;
  quote: string;
};

export type SharedCandidate = {
  displayName: string;
  status: string;
  matchScore: number | null;
  summary: string;
  evidence: ShortlistEvidence[];
  gaps: string[];
  interviewQuestions: string[];
};

export type SharedShortlist = {
  clientName: string;
  title: string;
  description: string;
  requiredSkills: string[];
  candidates: SharedCandidate[];
  fictional: boolean;
};

export type ShortlistCsvRow = {
  clientName: string;
  jobTitle: string;
  name: string;
  status: string;
  score: number | null;
  summary: string;
  evidence: string;
  gaps: string;
  fileName: string;
};

export const SHORTLIST_CSV_HEADERS = [
  "Client",
  "Job",
  "Name",
  "Status",
  "Criteria alignment",
  "Summary",
  "Evidence",
  "Gaps",
  "File name",
] as const;

/** A spreadsheet runs these as formulas, including after leading whitespace. */
const SPREADSHEET_FORMULA_START = /^(?:[\t\r\n]|\s*[=+\-@])/;

export function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const text =
    typeof value === "string" && SPREADSHEET_FORMULA_START.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function shortlistCsv(rows: ShortlistCsvRow[]): string {
  const lines = [
    SHORTLIST_CSV_HEADERS.map((header) => csvCell(header)).join(","),
    ...rows.map((row) =>
      [
        row.clientName,
        row.jobTitle,
        row.name,
        row.status,
        row.score == null ? "" : row.score,
        row.summary,
        row.evidence,
        row.gaps,
        row.fileName,
      ]
        .map((value) => csvCell(value))
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function evidenceText(evidence: ShortlistEvidence[]): string {
  return evidence.map((item) => `${item.skill}: ${item.quote}`).join(" | ");
}
