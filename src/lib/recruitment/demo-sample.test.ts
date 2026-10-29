import { describe, expect, it } from "vitest";
import { buildReviewNarrative } from "./review-narrative";
import { demoCandidates, demoHiringJob, getDemoCandidate } from "./demo-sample";

describe("demo hiring sample", () => {
  it("uses three fictional candidates on one stable job", () => {
    expect(demoCandidates.map((candidate) => candidate.id)).toEqual([
      "maya-chen",
      "jordan-ellis",
      "priya-nair",
    ]);
    expect(demoCandidates.every((candidate) => candidate.jobId === demoHiringJob.id)).toBe(true);
    expect(
      demoCandidates.every((candidate) => candidate.rawText.includes("FICTIONAL SAMPLE RESUME")),
    ).toBe(true);
  });

  it("explains Jordan with evidence and open questions", () => {
    const jordan = getDemoCandidate("jordan-ellis");
    expect(jordan?.review).toBeTruthy();

    const narrative = buildReviewNarrative({
      requirements: jordan!.review!.requirements,
      preferredEvidence: jordan!.analysis?.scoreBreakdown.preferredSkillEvidence,
    });

    expect(narrative.supporting.join(" ")).toMatch(/React/);
    expect(narrative.supporting.join(" ")).toMatch(/TypeScript/);
    expect(jordan?.analysis?.interviewQuestions.join(" ")).toMatch(/AWS/);
    expect(getDemoCandidate("maya-chen")?.analysis?.interviewQuestions).not.toEqual(
      jordan?.analysis?.interviewQuestions,
    );
    expect(narrative.supporting.join(" ")).toMatch(/FastAPI/);
    expect(narrative.supporting.join(" ")).toMatch(/structured records/);
    expect(narrative.furtherReview).toEqual([
      "The resume does not establish AWS.",
      "The resume does not establish Team leadership.",
    ]);
    expect([...narrative.supporting, ...narrative.furtherReview].join(" ")).not.toMatch(
      /lacks|missing|does not have/i,
    );
  });
});
