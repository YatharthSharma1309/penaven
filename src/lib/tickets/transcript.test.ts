import { describe, expect, it } from "vitest";
import { isUnansweredEscalation, lastAssistantReply } from "@/lib/chat/answer-outcome";
import { TICKET_LIMITS } from "./constants";
import { parseTicketInput } from "./input";
import { buildEscalationTranscript } from "./transcript";

const turn = (role: string, content: string) => ({ role, content });

describe("buildEscalationTranscript", () => {
  it("keeps a short conversation whole", () => {
    expect(
      buildEscalationTranscript([turn("user", "Hi"), turn("assistant", "Hello")]),
    ).toBe("user: Hi\n\nassistant: Hello");
  });

  it("keeps a conversation exactly at the limit", () => {
    const content = "a".repeat(TICKET_LIMITS.description - "user: ".length);
    expect(buildEscalationTranscript([turn("user", content)])).toHaveLength(
      TICKET_LIMITS.description,
    );
  });

  it("keeps the newest turns of a long conversation, within the limit", () => {
    const turns = Array.from({ length: 40 }, (_, index) =>
      index % 2 === 0
        ? turn("user", `question ${index} ${"q".repeat(3990)}`)
        : turn("assistant", `reply ${index} ${"r".repeat(1500)}`),
    );

    const transcript = buildEscalationTranscript(turns);

    expect(transcript.length).toBeLessThanOrEqual(TICKET_LIMITS.description);
    expect(transcript).toMatch(/^\[Earlier messages trimmed/);
    expect(transcript).toContain("reply 39");
    expect(transcript).not.toContain("question 0 ");
  });

  it("passes the ticket parser for a long conversation", () => {
    const turns = Array.from({ length: 30 }, () => turn("user", "x".repeat(4000)));
    const result = parseTicketInput(
      { title: "Escalation: x", description: buildEscalationTranscript(turns) },
      "HIGH",
    );
    expect(result).toHaveProperty("data");
  });

  it("still finds the last reply, so the unanswered check keeps working", () => {
    const turns = [
      turn("user", "u".repeat(7000)),
      turn("assistant", "Here is an old answer"),
      turn("user", "u".repeat(4000)),
      turn("assistant", "I could not find that."),
      turn("user", "Thanks"),
    ];
    const transcript = buildEscalationTranscript(turns);
    expect(lastAssistantReply(transcript)).toBe("I could not find that.");
    expect(isUnansweredEscalation(transcript)).toBe(true);
  });

  it("cuts one reply that is longer than the limit by itself", () => {
    const transcript = buildEscalationTranscript([
      turn("user", "Hi"),
      turn("assistant", "r".repeat(TICKET_LIMITS.description + 500)),
    ]);
    expect(transcript.length).toBeLessThanOrEqual(TICKET_LIMITS.description);
    expect(lastAssistantReply(transcript)).toMatch(/^r+$/);
  });
});
