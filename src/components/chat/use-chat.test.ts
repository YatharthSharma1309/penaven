import { describe, expect, it } from "vitest";
import { chatFailureMessage } from "./use-chat";

describe("chatFailureMessage", () => {
  it("turns a 429 into a plain sentence, not the raw server text", () => {
    expect(chatFailureMessage(429, "Rate limit exceeded")).toBe(
      "Too many questions for now. Please try again later.",
    );
  });

  it("keeps the server's message for other failures", () => {
    expect(chatFailureMessage(403, "The public demo is read-only.")).toBe(
      "The public demo is read-only.",
    );
    expect(chatFailureMessage(500)).toBe("Chat request failed");
  });
});
