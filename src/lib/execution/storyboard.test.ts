import { describe, expect, it } from "vitest";
import {
  buildExecutionStoryboard,
  publicRunLabel,
  storyboardHeadline,
  type StoryboardLogInput,
} from "./storyboard";

function modelLog(outcome: string): StoryboardLogInput {
  return {
    id: "log-1",
    createdAt: "2026-10-29T00:00:00.000Z",
    agent: "openrouter",
    trigger: "widget",
    model: "openrouter/free",
    decision: "replied",
    latencyMs: 120,
    metadata: { outcome },
  };
}

function headlineFor(outcome: string) {
  const steps = buildExecutionStoryboard([modelLog(outcome)]);
  // Guard: the fixture must land on the model stage for the headline branch.
  expect(steps[0].stage).toBe("model");
  return storyboardHeadline(steps);
}

describe("storyboardHeadline", () => {
  it("does not call an uncovered run answered from the docs", () => {
    expect(headlineFor("low_knowledge")).toBe("The docs did not cover this");
    expect(headlineFor("low_confidence")).toBe("The docs only partly covered this");
    expect(headlineFor("needs_human")).toBe("Needs a person");
  });

  it("calls a deflected run answered from the docs", () => {
    expect(headlineFor("deflected")).toBe("Answered from the docs");
  });
});

describe("publicRunLabel", () => {
  it("ignores inherited object keys", () => {
    expect(publicRunLabel("constructor")).toBe("constructor");
  });
});
