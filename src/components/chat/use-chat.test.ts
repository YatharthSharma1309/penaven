import { describe, expect, it } from "vitest";
import {
  CHAT_COPY,
  chatFailureMessage,
  handoffConfirmation,
  handoffFailureMessage,
} from "./use-chat";

const OWNER_SPEAK = /ticket|escalat|your docs|knowledge base|support can|—/i;

describe("visitor hand-off copy", () => {
  it("has no staff wording", () => {
    for (const text of Object.values(CHAT_COPY.visitor)) {
      expect(text).not.toMatch(OWNER_SPEAK);
    }
  });

  it("keeps the staff wording for the admin chat", () => {
    expect(CHAT_COPY.staff.needsConversation).toBe(
      "Wait for the chat to connect before escalating to a ticket.",
    );
  });

  it("keeps the ticket number for staff", () => {
    expect(
      handoffConfirmation({
        ticketId: "cm123ticketabcdef",
        duplicate: false,
        followsUp: false,
      }),
    ).toBe("Ticket #abcdef created with the full transcript.");
  });

  it("turns server failures into plain visitor sentences", () => {
    expect(handoffFailureMessage("visitor", 429, "Rate limit exceeded")).toBe(
      CHAT_COPY.visitor.handoffRateLimited,
    );
    expect(handoffFailureMessage("visitor", 400, "Enter a valid requester email")).toBe(
      "Enter a valid email address.",
    );
    expect(handoffFailureMessage("visitor", 400, "Description must be 20000 characters or fewer")).toBe(
      CHAT_COPY.visitor.handoffFailed,
    );
    expect(handoffFailureMessage("visitor", 503)).toBe(CHAT_COPY.visitor.handoffFailed);
    expect(handoffFailureMessage("staff", 400, "Invalid ticket priority")).toBe(
      "Invalid ticket priority",
    );
  });
});

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
