import { describe, expect, it } from "vitest";
import {
  buildWidgetIframeMarkup,
  buildWidgetLauncherScript,
  LEGACY_WIDGET_MESSAGE_TYPE,
  WIDGET_MESSAGE_TYPE,
} from "@/lib/widget/embed-snippet";

describe("widget embed snippets", () => {
  const url = "https://penaven.vercel.app/widget/embed?key=abc";

  it("listen for the Penaven message name, not the old one", () => {
    for (const snippet of [buildWidgetLauncherScript(url), buildWidgetIframeMarkup(url)]) {
      expect(snippet).toContain(WIDGET_MESSAGE_TYPE);
      expect(snippet).not.toContain(LEGACY_WIDGET_MESSAGE_TYPE);
      expect(snippet.toLowerCase()).not.toContain("opsconcierge");
    }
    expect(WIDGET_MESSAGE_TYPE).toBe("penaven-widget");
  });
});
