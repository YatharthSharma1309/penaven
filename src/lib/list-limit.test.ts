import { describe, expect, it } from "vitest";
import {
  cutForList,
  isListLimited,
  LIST_LIMIT,
  LIST_PREVIEW_LENGTH,
  listLimitNote,
} from "@/lib/list-limit";

describe("listLimitNote", () => {
  it("stays quiet at exactly the limit", () => {
    expect(isListLimited(LIST_LIMIT)).toBe(false);
    expect(listLimitNote(LIST_LIMIT, "tickets")).toBeNull();
  });

  it("names the newest 100 and the real total past the limit", () => {
    expect(isListLimited(LIST_LIMIT + 1)).toBe(true);
    expect(listLimitNote(240, "tickets")).toBe(
      "Showing the newest 100 of 240 tickets.",
    );
  });
});

describe("cutForList", () => {
  it("leaves text at the limit alone", () => {
    const text = "a".repeat(LIST_PREVIEW_LENGTH);
    expect(cutForList(text)).toBe(text);
  });

  it("cuts longer text and marks the cut", () => {
    const cut = cutForList("a".repeat(LIST_PREVIEW_LENGTH + 500));
    expect(cut).toBe(`${"a".repeat(LIST_PREVIEW_LENGTH)}…`);
  });

  it("drops trailing space before the mark", () => {
    expect(cutForList("hello world", 6)).toBe("hello…");
  });

  it("does not split an emoji at the cut", () => {
    const cut = cutForList(`abc${"\u{1F600}"}def`, 4);
    expect(cut).toBe("abc…");
    expect(cut.isWellFormed()).toBe(true);
  });
});
