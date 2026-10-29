import { describe, expect, it } from "vitest";
import {
  inboxDisplayStatus,
  inboxThreadLabel,
  isUnansweredEscalation,
  questionBeforeReply,
  supportRunOutcome,
  widgetAnswerState,
} from "./answer-outcome";

describe("supportRunOutcome", () => {
  it("does not call an I-don't-know reply deflected", () => {
    expect(
      supportRunOutcome({
        chunksMatched: 1,
        confidence: "medium",
        reply:
          "I don't have information about our Austin office address in my knowledge base.",
      }),
    ).toBe("needs_human");
  });

  it("marks a grounded policy answer as deflected", () => {
    expect(
      supportRunOutcome({
        chunksMatched: 1,
        confidence: "medium",
        reply: "Full refunds are available within 14 days of purchase.",
      }),
    ).toBe("deflected");
  });

  it("marks a miss with no chunks as low knowledge", () => {
    expect(
      supportRunOutcome({
        chunksMatched: 0,
        confidence: "low",
        reply: "I could not find relevant information in your knowledge base.",
      }),
    ).toBe("low_knowledge");
  });
});

describe("isUnansweredEscalation", () => {
  it("skips a ticket whose last reply already stated the policy", () => {
    const transcript = [
      "user: What is the refund policy?",
      "assistant: Full refunds are available within 14 days of purchase.",
    ].join("\n\n");
    expect(isUnansweredEscalation(transcript)).toBe(false);
  });

  it("keeps a ticket whose last reply says the docs do not cover it", () => {
    const transcript = [
      "user: What is the refund policy?",
      "assistant: Full refunds are available within 14 days of purchase.",
      "user: What is your Austin office street address?",
      "assistant: I don't have information about our Austin office address in my knowledge base.",
    ].join("\n\n");
    expect(isUnansweredEscalation(transcript)).toBe(true);
  });
});

describe("widgetAnswerState", () => {
  it("calls a cited policy answer from the docs", () => {
    expect(
      widgetAnswerState({
        reply: "Full refunds are available within 14 days of purchase.",
        sourceCount: 1,
        retrievalMode: "keyword",
      }),
    ).toBe("from_docs");
  });

  it("hides a citation when the reply says the docs do not cover it", () => {
    expect(
      widgetAnswerState({
        reply: "I don't have information about our Austin office address.",
        sourceCount: 1,
        retrievalMode: "keyword",
      }),
    ).toBe("needs_person");
  });

  it("treats the monthly cap as a handoff", () => {
    expect(
      widgetAnswerState({
        reply: "This workspace has used its included answers for the month.",
        sourceCount: 0,
        retrievalMode: "monthly_cap",
      }),
    ).toBe("needs_person");
  });

  it("stays quiet while the reply is still empty", () => {
    expect(
      widgetAnswerState({ reply: "", sourceCount: 0, retrievalMode: "keyword" }),
    ).toBeNull();
  });
});

describe("inboxThreadLabel", () => {
  it("does not call a don't-know reply answered", () => {
    expect(
      inboxThreadLabel({
        lastRole: "ASSISTANT",
        lastAssistantReply: "I don't have enough information to answer that.",
        hasOpenTicket: false,
      }),
    ).toBe("waiting");
  });

  it("calls a grounded reply answered when nobody is holding the case", () => {
    expect(
      inboxThreadLabel({
        lastRole: "ASSISTANT",
        lastAssistantReply: "Full refunds are available within 14 days.",
        hasOpenTicket: false,
      }),
    ).toBe("answered");
  });

  it("keeps an open ticket waiting on a person", () => {
    expect(
      inboxThreadLabel({
        lastRole: "ASSISTANT",
        lastAssistantReply: "Full refunds are available within 14 days.",
        hasOpenTicket: true,
      }),
    ).toBe("waiting");
  });
});

describe("inboxDisplayStatus", () => {
  it("keeps an open case waiting for a human", () => {
    expect(
      inboxDisplayStatus({
        lastRole: "ASSISTANT",
        lastAssistantReply: "Full refunds are available within 14 days.",
        hasOpenTicket: true,
      }),
    ).toBe("waiting_for_human");
  });

  it("calls a customer message with no case open", () => {
    expect(
      inboxDisplayStatus({
        lastRole: "USER",
        lastAssistantReply: "Full refunds are available within 14 days.",
        hasOpenTicket: false,
      }),
    ).toBe("open");
  });

  it("calls a grounded reply answered", () => {
    expect(
      inboxDisplayStatus({
        lastRole: "ASSISTANT",
        lastAssistantReply: "Full refunds are available within 14 days.",
        hasOpenTicket: false,
      }),
    ).toBe("answered");
  });
});

describe("questionBeforeReply", () => {
  it("uses the customer question that came before the marked reply", () => {
    const topic = questionBeforeReply(
      [
        {
          content: "What is the refund policy?",
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        },
        {
          content: "What is the Austin office address?",
          createdAt: new Date("2026-10-02T00:00:00.000Z"),
        },
      ],
      new Date("2026-10-02T00:01:00.000Z"),
    );
    expect(topic).toBe("What is the Austin office address?");
  });
});
