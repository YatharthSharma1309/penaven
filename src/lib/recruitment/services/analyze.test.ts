import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ messages: [] as Array<{ role: string; content: string }> }));
const candidateFindFirst = vi.hoisted(() => vi.fn());
const analysisUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai", () => ({
  getChatModel: () => "test-model",
  getAiClient: () => ({
    chat: {
      completions: {
        create: async (input: { messages: Array<{ role: string; content: string }> }) => {
          sent.messages = input.messages;
          return { choices: [{ message: { content: JSON.stringify(modelAnswer) } }] };
        },
      },
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    candidate: { findFirst: candidateFindFirst },
    candidateAnalysis: { upsert: analysisUpsert },
  },
}));

import { analyzeCandidate } from "@/lib/recruitment/services/analyze";

const modelAnswer = {
  summary: "Backend engineer with Ruby and PostgreSQL work.",
  extractedSkills: ["Ruby", "PostgreSQL"],
  matchScore: 80,
  matchRationale: "Ruby and PostgreSQL are quoted from work history.",
  missingSkills: [],
  interviewQuestions: ["Q1?", "Q2?", "Q3?"],
  evidence: {
    matchedRequiredSkills: [
      {
        skill: "Ruby",
        evidence: "[name] built billing services in Ruby on Rails.",
        confidence: 0.9,
        matchType: "exact",
      },
    ],
    matchedPreferredSkills: [],
    missingRequiredSkills: [],
    missingPreferredSkills: [],
    roleAlignment: { score: 0.8, evidence: "Backend role." },
    experience: { score: 0.7, years: 5, evidence: "5 years." },
    educationMatches: [],
    certificationMatches: [],
    parseQuality: { score: 0.9, concerns: [] },
  },
};

const rawText = [
  "Ruby Okafor",
  "ruby.okafor@example.com | +91 98765 43210 | github.com/rokafor",
  "DOB: 02/03/1994 | Gender: Female",
  "Experience",
  "Okafor built billing services in Ruby on Rails, 2019-2023 (5 years).",
  "Tuned PostgreSQL queries for the billing team.",
].join("\n");

beforeEach(() => {
  sent.messages = [];
  candidateFindFirst.mockReset();
  analysisUpsert.mockReset();
  candidateFindFirst.mockResolvedValue({
    id: "cand",
    displayName: "Ruby Okafor",
    parseStatus: "ok",
    rawText,
    job: {
      title: "Backend engineer",
      description: "Build billing services.",
      requiredSkills: JSON.stringify(["Ruby", "PostgreSQL"]),
      preferredSkills: "[]",
      educationRequirements: "[]",
      certifications: "[]",
      experienceLevel: null,
      minYearsExperience: null,
      roleType: null,
    },
  });
  analysisUpsert.mockImplementation(async ({ create }) => ({
    id: "analysis",
    ...create,
  }));
});

describe("analyzeCandidate redaction", () => {
  it("sends the model the resume without personal details", async () => {
    await analyzeCandidate("org", "cand");
    const user = sent.messages.find((message) => message.role === "user")?.content ?? "";

    expect(user).not.toContain("Okafor");
    expect(user).not.toContain("ruby.okafor@example.com");
    expect(user).not.toContain("98765");
    expect(user).not.toContain("github.com/rokafor");
    expect(user).not.toContain("1994");
    expect(user).not.toContain("Female");
    expect(user).toContain("[email] | [phone] | [link]");
    // The first name is also a required skill, so it stays; the surname goes.
    expect(user).toContain("[name] built billing services in Ruby on Rails, 2019-2023 (5 years).");
    expect(user).toContain("Tuned PostgreSQL queries");
  });

  it("scores against the same redacted text and keeps the stored resume whole", async () => {
    await analyzeCandidate("org", "cand");
    const { create } = analysisUpsert.mock.calls[0][0];
    const breakdown = JSON.parse(create.scoreBreakdown);

    expect(breakdown.matchedRequiredSkills).toEqual(["Ruby", "PostgreSQL"]);
    expect(breakdown.requiredSkillEvidence[0].evidence).toBe(
      "[name] built billing services in Ruby on Rails.",
    );
    expect(create).not.toHaveProperty("rawText");
    expect(rawText).toContain("ruby.okafor@example.com");
  });
});
