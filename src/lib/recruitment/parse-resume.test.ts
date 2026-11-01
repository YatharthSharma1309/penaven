import { describe, expect, it } from "vitest";
import { appConfig } from "@/lib/recruitment/config";
import {
  displayNameFromFileName,
  extractTextFromBuffer,
  normalizeResumeText,
  stripPdfPageMarkers,
} from "@/lib/recruitment/parse-resume";
import { updateCandidateSchema } from "@/lib/recruitment/validators";

/** A valid PDF with the given number of pages and no text on any of them. */
function blankPdf(pageCount: number): Buffer {
  const kids = Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    ),
  ];

  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

describe("PDF page markers", () => {
  it("leaves nothing behind for a blank four page PDF", async () => {
    await expect(extractTextFromBuffer(blankPdf(4), "application/pdf")).resolves.toBe("");
  });

  it("removes every marker from text and keeps the resume", () => {
    const parsed =
      "\n\n-- 1 of 4 --\n\nMaya Chen\nSupport lead\n\n-- 2 of 4 --\n\n  --  3 of 4  --  \n\n-- 4 of 4 --\n";

    expect(stripPdfPageMarkers(parsed).trim()).toBe("Maya Chen\nSupport lead");
  });

  it("keeps resume lines that only look similar", () => {
    const text = "Handled 1 of 4 regions\n-- Led 2 of 4 teams --\n1 of 4";

    expect(stripPdfPageMarkers(text)).toBe(text);
  });
});

describe("normalizeResumeText", () => {
  const limit = appConfig.maxResumeTextChars;

  it("leaves text at the limit alone", () => {
    const text = "a".repeat(limit);

    expect(normalizeResumeText(text)).toBe(text);
  });

  it("stays inside the limit once truncated", () => {
    const stored = normalizeResumeText("a".repeat(limit + 500));

    expect(stored).toHaveLength(limit);
    expect(stored.endsWith("[Truncated for analysis]")).toBe(true);
  });

  it("stores truncated text that can be saved again unchanged", () => {
    const stored = normalizeResumeText("a".repeat(limit + 500));

    const parsed = updateCandidateSchema.safeParse({ rawText: stored });

    expect(parsed.success).toBe(true);
    expect(normalizeResumeText(stored)).toBe(stored);
  });

  it("does not leave half an emoji at the cut", () => {
    const stored = normalizeResumeText(`${"a".repeat(limit - 27)}😀${"b".repeat(100)}`);

    expect(stored.isWellFormed()).toBe(true);
  });
});

describe("resume text saved by an earlier version", () => {
  const limit = appConfig.maxResumeTextChars;
  const legacy = `${"a".repeat(limit)}\n\n[Truncated for analysis]`;

  it("can be saved again and comes back inside the limit", () => {
    const parsed = updateCandidateSchema.safeParse({ rawText: legacy });

    expect(parsed.success).toBe(true);
    expect(normalizeResumeText(legacy).length).toBeLessThanOrEqual(limit);
    expect(normalizeResumeText(legacy).match(/\[Truncated for analysis\]/g)).toHaveLength(1);
  });

  it("does not open the limit to other long text", () => {
    expect(updateCandidateSchema.safeParse({ rawText: "a".repeat(limit + 1) }).success).toBe(
      false,
    );
    expect(updateCandidateSchema.safeParse({ rawText: `${legacy}!` }).success).toBe(false);
  });
});

describe("displayNameFromFileName", () => {
  it("limits names to the 120 characters a later save accepts", () => {
    const name = displayNameFromFileName(`${"a".repeat(300)}.pdf`);

    expect(name).toHaveLength(120);
    expect(updateCandidateSchema.safeParse({ displayName: name }).success).toBe(true);
  });

  it("does not cut an emoji in half", () => {
    const name = displayNameFromFileName(`${"a".repeat(119)}😀😀.pdf`);

    expect(name).toBe("a".repeat(119));
  });

  it("keeps the existing clean up", () => {
    expect(displayNameFromFileName("maya_chen-cv.pdf")).toBe("maya chen cv");
    expect(displayNameFromFileName(".pdf")).toBe("Candidate");
  });
});
