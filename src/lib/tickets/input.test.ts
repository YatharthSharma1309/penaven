import { describe, expect, it } from "vitest";
import { TICKET_LIMITS } from "./constants";
import { parseCommentContent, parseTicketInput, parseTicketTake } from "./input";

describe("parseTicketInput", () => {
  it("applies defaults and trims", () => {
    expect(parseTicketInput({ title: "  Refund " }, "MEDIUM")).toEqual({
      data: {
        title: "Refund",
        description: "Refund",
        priority: "MEDIUM",
        conversationId: null,
        requesterEmail: null,
        requesterName: null,
      },
    });
  });

  it("uses the title as the description of an escalation", () => {
    const result = parseTicketInput({ title: "Escalation: refund" }, "HIGH");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.description).toBe("Escalation: refund");
    expect(result.data.priority).toBe("HIGH");
  });

  it("does not call a plain ticket an escalation", () => {
    const result = parseTicketInput({ title: "Printer on fire" }, "MEDIUM");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.description).toBe("Printer on fire");
  });

  it("accepts every field at its limit, measured after trimming", () => {
    const result = parseTicketInput(
      {
        title: ` ${"t".repeat(TICKET_LIMITS.title)} `,
        description: "d".repeat(TICKET_LIMITS.description),
        requesterName: "n".repeat(TICKET_LIMITS.requesterName),
      },
      "MEDIUM",
    );
    expect(result).toHaveProperty("data");
  });

  it.each([
    ["title", { title: "t".repeat(TICKET_LIMITS.title + 1) }],
    ["description", { title: "t", description: "d".repeat(TICKET_LIMITS.description + 1) }],
    ["requesterName", { title: "t", requesterName: "n".repeat(TICKET_LIMITS.requesterName + 1) }],
  ])("rejects a %s over its limit", (_field, body) => {
    expect(parseTicketInput(body, "MEDIUM")).toHaveProperty("error");
  });

  it("keeps valid requester details", () => {
    const result = parseTicketInput(
      { title: "t", requesterEmail: " a@example.com ", requesterName: " Asha " },
      "MEDIUM",
    );
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.requesterEmail).toBe("a@example.com");
    expect(result.data.requesterName).toBe("Asha");
  });

  it("treats a blank optional field as not given", () => {
    const result = parseTicketInput(
      { title: "t", requesterEmail: "", requesterName: null, conversationId: "" },
      "MEDIUM",
    );
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.requesterEmail).toBeNull();
    expect(result.data.requesterName).toBeNull();
    expect(result.data.conversationId).toBeNull();
  });

  it.each([
    [{}],
    [{ title: "" }],
    [{ title: "   " }],
    [{ title: {} }],
    [{ title: 5 }],
    [{ title: ["a"] }],
    [{ title: { toString: 1 } }],
    [{ title: "t", description: {} }],
    [{ title: "t", description: 0 }],
    [{ title: "t", priority: "NOPE" }],
    [{ title: "t", priority: 1 }],
    [{ title: "t", priority: "" }],
    [{ title: "t", conversationId: 5 }],
    [{ title: "t", conversationId: false }],
    [{ title: "t", requesterName: 123 }],
    [{ title: "t", requesterName: false }],
    [{ title: "t", requesterEmail: "not-an-email" }],
    [{ title: "t", requesterEmail: "a@b" }],
    [{ title: "t", requesterEmail: 5 }],
    [{ title: "t", requesterEmail: `${"a".repeat(250)}@example.com` }],
  ])("rejects %j", (body) => {
    expect(parseTicketInput(body, "MEDIUM")).toHaveProperty("error");
  });
});

describe("parseCommentContent", () => {
  it("trims a comment and accepts one at the limit", () => {
    expect(parseCommentContent(" hi ")).toEqual({ content: "hi" });
    expect(parseCommentContent("c".repeat(TICKET_LIMITS.comment))).toHaveProperty("content");
  });

  it.each([[5], [""], ["  "], [null], ["c".repeat(TICKET_LIMITS.comment + 1)]])(
    "rejects %j",
    (value) => {
      expect(parseCommentContent(value)).toHaveProperty("error");
    },
  );
});

describe("parseTicketTake", () => {
  it.each([
    [null, 200],
    ["", 200],
    ["50", 50],
    ["1", 1],
    ["200", 200],
    ["201", 200],
    ["999999999999", 200],
    ["0", 200],
    ["-5", 200],
    ["abc", 200],
    ["1.5", 200],
  ])("reads %j as %i", (value, expected) => {
    expect(parseTicketTake(value)).toBe(expected);
  });
});
