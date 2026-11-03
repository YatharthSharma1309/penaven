import { describe, expect, it } from "vitest";
import { normalizeWordForm } from "./word-forms";

function sameForm(...words: string[]) {
  return new Set(words.map(normalizeWordForm)).size === 1;
}

describe("normalizeWordForm", () => {
  it("folds plurals and verb endings to one form", () => {
    expect(sameForm("refund", "refunds", "refunded", "refunding")).toBe(true);
    expect(
      sameForm(
        "cancel",
        "cancels",
        "cancelled",
        "canceled",
        "cancelling",
        "cancellation",
        "cancellations",
      ),
    ).toBe(true);
    expect(sameForm("ship", "ships", "shipped", "shipping")).toBe(true);
    expect(sameForm("return", "returns", "returned", "returning")).toBe(true);
    expect(sameForm("policy", "policies")).toBe(true);
    expect(sameForm("reply", "replies", "replied")).toBe(true);
    expect(sameForm("charge", "charges", "charged", "charging")).toBe(true);
    expect(sameForm("box", "boxes")).toBe(true);
    expect(sameForm("class", "classes")).toBe(true);
    expect(sameForm("bill", "billed", "billing")).toBe(true);
  });

  it("leaves short words, digits and -s words that are not plurals alone", () => {
    for (const word of ["bus", "fee", "use", "news", "status", "analysis", "24", "ppo"]) {
      expect(normalizeWordForm(word)).toBe(word);
    }
    expect(normalizeWordForm("need")).toBe("need");
    expect(normalizeWordForm("thing")).toBe("thing");
    expect(normalizeWordForm("bring")).toBe("bring");
  });

  it("keeps different words apart", () => {
    expect(sameForm("card", "care")).toBe(false);
    expect(sameForm("ship", "shop")).toBe(false);
    expect(sameForm("refund", "fund")).toBe(false);
  });
});
