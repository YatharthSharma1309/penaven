import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

const WORDS = [
  "password", "reset", "changes", "account", "billing", "invoice", "refund",
  "shipping", "support", "workspace", "settings", "upload", "document",
];

function prose(wordCount: number) {
  return Array.from({ length: wordCount }, (_, i) => WORDS[(i * 7) % WORDS.length]).join(" ");
}

function isWholeWords(chunk: string, source: string) {
  const at = source.indexOf(chunk);
  if (at < 0) return false;
  const before = source[at - 1];
  const after = source[at + chunk.length];
  return (before === undefined || /\s/.test(before)) && (after === undefined || /\s/.test(after));
}

describe("chunkText", () => {
  it("returns nothing for blank text", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });

  it("keeps short text as one chunk", () => {
    expect(chunkText("Reset your password from Settings.")).toEqual([
      "Reset your password from Settings.",
    ]);
  });

  it("never starts or ends a chunk part way through a word", () => {
    const text = prose(600);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(isWholeWords(chunk, text)).toBe(true);
    }
  });

  it("keeps chunks within the size and overlapping", () => {
    const text = prose(600);
    const chunks = chunkText(text, 200, 40);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
    for (let i = 1; i < chunks.length; i++) {
      const firstWord = chunks[i].split(" ")[0];
      expect(chunks[i - 1]).toContain(firstWord);
    }
  });

  it("covers every word of the text", () => {
    const text = prose(400);
    const joined = chunkText(text, 150, 30).join(" ");
    for (const word of new Set(text.split(" "))) {
      expect(joined).toContain(word);
    }
  });

  it("prefers a line break for the end", () => {
    const first = "a".repeat(10) + " " + "word ".repeat(100);
    const text = `${first.trim()}\n${"next ".repeat(100).trim()}`;
    const chunks = chunkText(text, 800, 120);
    expect(chunks[0]).toBe(first.trim());
  });

  it("still splits one very long word", () => {
    const chunks = chunkText("x".repeat(2000), 800, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").replaceAll("x", "")).toBe("");
  });
});
