import { describe, expect, it } from "vitest";
import { demoShortlistCsv } from "@/lib/recruitment/demo-sample";
import { csvCell, shortlistCsv, type ShortlistCsvRow } from "@/lib/recruitment/shortlist";

describe("shortlistCsv", () => {
  it("quotes commas and keeps the client, evidence, and gaps", () => {
    const row: ShortlistCsvRow = {
      clientName: "Harbor & Co.",
      jobTitle: "Full-Stack Engineer",
      name: "Maya Chen",
      status: "Shortlisted",
      score: 91,
      summary: 'Quotes "React" and AWS.',
      evidence: "React: Built the customer portal",
      gaps: "Team leadership",
      fileName: "maya-chen.pdf",
    };

    const csv = shortlistCsv([row]);

    expect(csv.startsWith("\uFEFFClient,Job,Name,Status")).toBe(true);
    expect(csv).toContain('"Quotes ""React"" and AWS."');
    expect(csv).toContain("Harbor & Co.,Full-Stack Engineer,Maya Chen,Shortlisted,91");
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("keeps a reader on a row with a formula name", () => {
    const row: ShortlistCsvRow = {
      clientName: "Harbor",
      jobTitle: "Engineer",
      name: '=HYPERLINK("http://evil.test","Click")',
      status: "Hired",
      score: 80,
      summary: "",
      evidence: "",
      gaps: "",
      fileName: "",
    };

    expect(shortlistCsv([row])).toContain(
      `Harbor,Engineer,"'=HYPERLINK(""http://evil.test"",""Click"")",Hired,80`,
    );
  });
});

describe("csvCell formula protection", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+1 555 0100", "'+1 555 0100"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tTabbed", "'\tTabbed"],
    ["\rReturned", `"'\rReturned"`],
    ["\nNewline", `"'\nNewline"`],
    ["  =1+1", "'  =1+1"],
  ])("neutralises %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("neutralises first, then quotes", () => {
    expect(csvCell("=SUM(A1,B1)")).toBe(`"'=SUM(A1,B1)"`);
    expect(csvCell('=A1&"x"')).toBe(`"'=A1&""x"""`);
  });

  it("leaves ordinary text and numbers alone", () => {
    expect(csvCell("Maya Chen")).toBe("Maya Chen");
    expect(csvCell("Rate 5-10 a+b")).toBe("Rate 5-10 a+b");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });
});

describe("the sample export", () => {
  it("goes through the same CSV path", () => {
    const csv = demoShortlistCsv();

    expect(csv.startsWith("﻿Client,Job,Name,Status")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    for (const line of csv.split("\r\n").slice(1)) {
      expect(line).not.toMatch(/(^|,)[=+\-@]/);
    }
  });
});
