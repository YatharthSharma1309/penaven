import { describe, expect, it } from "vitest";
import { parseTicketInput } from "./input";

describe("parseTicketInput", () => {
  it("applies defaults and trims", () => {
    expect(parseTicketInput({ title: "  Refund " }, "MEDIUM")).toEqual({
      data: {
        title: "Refund",
        description: "Escalation request: Refund",
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
