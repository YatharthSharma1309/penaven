import { describe, expect, it } from "vitest";
import { markdownToPlainText } from "./plain-text";

describe("markdownToPlainText", () => {
  it("drops headings, list markers, emphasis, code and link syntax", () => {
    expect(
      markdownToPlainText(
        "# PipelineKit FAQ\n## Password reset\n- **Go to** _Settings_ > `Security`.\n2. See [the guide](https://x.test).",
      ),
    ).toBe("PipelineKit FAQ\nPassword reset\nGo to Settings > Security.\nSee the guide.");
  });

  it("keeps a lone asterisk or underscore inside words", () => {
    expect(markdownToPlainText("A 2*3 box_size tag, rated 4*")).toBe(
      "A 2*3 box_size tag, rated 4*",
    );
  });

  it("keeps a hash that is not a heading", () => {
    expect(markdownToPlainText("Order #1234 shipped")).toBe("Order #1234 shipped");
  });
});
