import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({
  client: null as null | { chat: { completions: { create: () => Promise<unknown> } } },
}));

vi.mock("@/lib/ai", () => ({
  getAiClient: () => ai.client,
  getChatModel: () => "test-model",
}));

const candidateFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { candidate: { findFirst: candidateFindFirst } },
}));

import { RecruitmentError } from "@/lib/recruitment/errors";
import { createChatCompletion } from "@/lib/recruitment/openrouter";
import { analyzeCandidate } from "@/lib/recruitment/services/analyze";
import { generateJobCriteria } from "@/lib/recruitment/services/job-assist";

function modelReturns(content: string) {
  ai.client = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  };
}

async function caught(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error as RecruitmentError;
  }
  throw new Error("expected a failure");
}

beforeEach(() => {
  ai.client = null;
  candidateFindFirst.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recruitment AI errors", () => {
  it("reports a missing AI key as 503", async () => {
    const error = await caught(() => createChatCompletion({ messages: [] }));
    expect(error).toBeInstanceOf(RecruitmentError);
    expect(error.status).toBe(503);
    expect(error.code).toBe("MISSING_API_KEY");
  });

  it.each([
    ["JSON that fails the schema", '{"requiredSkills":5}'],
    ["text that is not JSON", "no json here"],
  ])("job assist hides the parser message for %s", async (_label, content) => {
    modelReturns(content);
    const error = await caught(() => generateJobCriteria({ title: "Engineer" }));
    expect(error.status).toBe(502);
    expect(error.code).toBe("INVALID_JOB_ASSIST_JSON");
    expect(error.message).toBe("The assistant returned an unusable answer. Try again.");
  });

  it("analysis hides the parser message", async () => {
    candidateFindFirst.mockResolvedValue({
      parseStatus: "ok",
      rawText: "r".repeat(60),
      job: {
        title: "Engineer",
        description: "d".repeat(30),
        requiredSkills: "[]",
        preferredSkills: "[]",
        educationRequirements: "[]",
        certifications: "[]",
        experienceLevel: null,
        minYearsExperience: null,
        roleType: null,
      },
    });
    modelReturns('{"matchScore":"high"}');

    const error = await caught(() => analyzeCandidate("org", "cand"));
    expect(error.status).toBe(502);
    expect(error.code).toBe("INVALID_MODEL_JSON");
    expect(error.message).toBe("The assistant returned an unusable answer. Try again.");
  });
});
