import { describe, expect, it } from "vitest";
import { splitBold } from "@/components/chat/message-text";

describe("splitBold", () => {
  it("turns **text** into a bold part", () => {
    expect(splitBold("Go to **Settings → Security → Reset Password**, then sign in.")).toEqual([
      { text: "Go to ", bold: false },
      { text: "Settings → Security → Reset Password", bold: true },
      { text: ", then sign in.", bold: false },
    ]);
  });

  it("handles several bold parts and plain text", () => {
    expect(splitBold("**A** and **B**")).toEqual([
      { text: "A", bold: true },
      { text: " and ", bold: false },
      { text: "B", bold: true },
    ]);
    expect(splitBold("No emphasis here.")).toEqual([{ text: "No emphasis here.", bold: false }]);
  });

  it("leaves lone or unmatched asterisks as they are", () => {
    expect(splitBold("2 ** 3 is maths")).toEqual([{ text: "2 ** 3 is maths", bold: false }]);
    expect(splitBold("**open only")).toEqual([{ text: "**open only", bold: false }]);
  });

  it("never treats HTML as markup", () => {
    expect(splitBold("**<img src=x onerror=alert(1)>**")).toEqual([
      { text: "<img src=x onerror=alert(1)>", bold: true },
    ]);
  });
});
