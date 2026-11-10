import { describe, expect, it } from "vitest";
import type { Candidate, CandidateAnalysis, Job } from "@/generated/prisma/client";
import {
  compareByMustHaves,
  contradictionCount,
  orderByMustHaves,
  pickMostMustHavesShown,
} from "@/lib/recruitment/candidate-order";
import { getBestCandidate, toJobDetailDTO } from "@/lib/recruitment/serializers";
import type { CandidateReview, RequirementRow } from "@/lib/recruitment/types";

function review(rows: RequirementRow["verdict"][]): CandidateReview {
  const requirements = rows.map((verdict, index) => ({
    skill: `Skill ${index}`,
    verdict,
    evidence: null,
  }));
  return {
    summary: "",
    matchRationale: "",
    matchedRequiredCount: requirements.filter(
      (row) => row.verdict !== "not_shown" && row.verdict !== "contradictory",
    ).length,
    requiredCount: requirements.length,
    missingRequiredSkills: [],
    requirements,
  };
}

function person(id: string, createdAt: string, rows: RequirementRow["verdict"][] | null, score: number | null) {
  return { id, createdAt, review: rows ? review(rows) : null, matchScore: score };
}

describe("compareByMustHaves", () => {
  it("puts more must-haves first even when the percentage is lower", () => {
    const highScore = person("high", "2026-10-01T00:00:00Z", ["shown", "not_shown", "not_shown"], 95);
    const moreShown = person("more", "2026-10-01T00:00:00Z", ["shown", "inferred", "not_shown"], 40);
    expect(orderByMustHaves([highScore, moreShown]).map((c) => c.id)).toEqual(["more", "high"]);
  });

  it("breaks a tie with fewer Contradicts, then newest", () => {
    const contradicts = person("contradicts", "2026-10-05T00:00:00Z", ["shown", "contradictory"], 90);
    const clean = person("clean", "2026-10-01T00:00:00Z", ["shown", "not_shown"], 10);
    const cleanNewer = person("clean-newer", "2026-10-03T00:00:00Z", ["shown", "not_shown"], 5);
    expect(orderByMustHaves([contradicts, clean, cleanNewer]).map((c) => c.id)).toEqual([
      "clean-newer",
      "clean",
      "contradicts",
    ]);
    expect(contradictionCount(contradicts)).toBe(1);
  });

  it("puts unanalyzed candidates last, newest first among them", () => {
    const older = person("older", "2026-10-01T00:00:00Z", null, null);
    const newer = person("newer", "2026-10-09T00:00:00Z", null, null);
    const analyzed = person("analyzed", "2026-09-01T00:00:00Z", ["not_shown"], 20);
    expect(orderByMustHaves([older, newer, analyzed]).map((c) => c.id)).toEqual([
      "analyzed",
      "newer",
      "older",
    ]);
  });

  it("does not mutate its input", () => {
    const list = [person("a", "2026-10-01T00:00:00Z", null, null), person("b", "2026-10-02T00:00:00Z", ["shown"], 1)];
    orderByMustHaves(list);
    expect(list.map((c) => c.id)).toEqual(["a", "b"]);
    expect(compareByMustHaves(list[0], list[0])).toBe(0);
  });
});

describe("pickMostMustHavesShown", () => {
  it("picks by must-haves, not percentage", () => {
    const picked = pickMostMustHavesShown([
      person("high", "2026-10-01T00:00:00Z", ["shown", "not_shown"], 99),
      person("more", "2026-10-01T00:00:00Z", ["shown", "unverified"], 30),
    ]);
    expect(picked?.id).toBe("more");
  });

  it("highlights nobody when no must-have is addressed", () => {
    expect(
      pickMostMustHavesShown([person("a", "2026-10-01T00:00:00Z", ["not_shown", "contradictory"], 80)]),
    ).toBeNull();
    expect(pickMostMustHavesShown([person("b", "2026-10-01T00:00:00Z", null, null)])).toBeNull();
  });
});

describe("serializers use the must-have order", () => {
  const job = {
    id: "job",
    title: "Engineer",
    description: "Build things.",
    requiredSkills: JSON.stringify(["React", "AWS"]),
    preferredSkills: "[]",
    experienceLevel: null,
    minYearsExperience: null,
    educationRequirements: "[]",
    certifications: "[]",
    roleType: null,
    clientName: "Client",
    autoRejectEnabled: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  } as unknown as Job;

  function row(
    id: string,
    createdAt: string,
    analysis: { score: number; matched: string[]; missing: string[] } | null,
    status = "new",
  ) {
    return {
      id,
      jobId: "job",
      displayName: id,
      fileName: null,
      filePath: null,
      mimeType: null,
      parseStatus: "ok",
      status,
      notes: null,
      rawText: "",
      createdAt: new Date(createdAt),
      autoRejectedAt: null,
      autoRejectReason: null,
      interviewScorecard: null,
      analysis: analysis
        ? ({
            id: `${id}-analysis`,
            candidateId: id,
            summary: "",
            extractedSkills: "[]",
            matchScore: analysis.score,
            scoreBreakdown: JSON.stringify({
              matchedRequiredSkills: analysis.matched,
              missingRequiredSkills: analysis.missing,
              requiredSkillEvidence: [],
            }),
            matchRationale: "",
            missingSkills: "[]",
            interviewQuestions: "[]",
            analyzedAt: new Date(createdAt),
            modelId: null,
          } as unknown as CandidateAnalysis)
        : null,
    } as unknown as Omit<Candidate, "fileBytes"> & { analysis: CandidateAnalysis | null };
  }

  const candidates = [
    row("high-score", "2026-10-02T00:00:00Z", { score: 92, matched: ["React"], missing: ["AWS"] }),
    row("both-shown", "2026-10-01T00:00:00Z", { score: 61, matched: ["React", "AWS"], missing: [] }),
    row("not-read", "2026-10-05T00:00:00Z", null),
    row("archived", "2026-10-06T00:00:00Z", { score: 50, matched: ["React", "AWS"], missing: [] }, "archived"),
  ];

  it("orders the job's candidates by must-haves shown, unanalyzed last", () => {
    const detail = toJobDetailDTO(job, candidates);
    expect(detail.candidates.map((c) => c.id)).toEqual([
      "archived",
      "both-shown",
      "high-score",
      "not-read",
    ]);
    // The percentage is still there to show.
    expect(detail.candidates.find((c) => c.id === "high-score")?.matchScore).toBe(92);
  });

  it("highlights the active candidate with the most must-haves, not the top score", () => {
    expect(getBestCandidate(candidates, ["React", "AWS"])?.id).toBe("both-shown");
  });
});
