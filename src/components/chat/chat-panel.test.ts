import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SANDBOX_NOTICE } from "@/lib/env/public-demo";
import { ChatPanel } from "./chat-panel";

function render(props: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return renderToString(createElement(ChatPanel, { hasDocuments: true, ...props }));
}

const widget = { compact: true, mode: "widget", widgetKey: "wk_test" } as const;

beforeEach(() => {
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("public sandbox notice", () => {
  it("has the agreed wording", () => {
    expect(DEMO_SANDBOX_NOTICE).toBe("Public sandbox. Other visitors can see what you type.");
  });

  it("shows on the admin chat and the widget in the public demo", () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "true");
    expect(render()).toContain(DEMO_SANDBOX_NOTICE);
    expect(render(widget)).toContain(DEMO_SANDBOX_NOTICE);
  });

  it("stays off real workspaces", () => {
    expect(render()).not.toContain(DEMO_SANDBOX_NOTICE);
    expect(render(widget)).not.toContain(DEMO_SANDBOX_NOTICE);
  });
});

describe("admin chat hand-off", () => {
  it("points demo visitors to the widget, because /api/tickets is blocked", () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "true");
    const html = render();
    expect(html).toContain("Try the hand-off in the widget");
    expect(html).not.toContain("Hand this to a person");
  });

  it("keeps the button for real workspaces", () => {
    const html = render();
    expect(html).toContain("Hand this to a person");
    expect(html).not.toContain("Try the hand-off in the widget");
  });
});
