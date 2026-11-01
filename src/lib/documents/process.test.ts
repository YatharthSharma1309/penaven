import { describe, expect, it, vi } from "vitest";

const pdf = vi.hoisted(() => ({ text: "" }));

vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText = async () => ({ text: pdf.text });
    destroy = async () => {};
  },
}));

import { extractTextFromBuffer } from "@/lib/documents/process";
import { chunkText } from "@/lib/rag/chunk";

async function pdfText(text: string) {
  pdf.text = text;
  return extractTextFromBuffer(Buffer.from("%PDF"), "guide.pdf", "application/pdf");
}

describe("PDF page markers in a knowledge document", () => {
  it("leaves a blank PDF with nothing to chunk, so it stays failed", async () => {
    const text = await pdfText("\n\n-- 1 of 2 --\n\n\n\n-- 2 of 2 --\n");
    expect(chunkText(text)).toEqual([]);
  });

  it("keeps the page text and drops the markers", async () => {
    const text = await pdfText("Refunds take 5 days.\n\n-- 1 of 1 --\n");
    expect(text).toContain("Refunds take 5 days.");
    expect(text).not.toContain("1 of 1");
  });
});
