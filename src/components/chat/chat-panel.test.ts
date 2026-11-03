import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SANDBOX_NOTICE } from "@/lib/env/public-demo";
import { ChatPanel, MessageBubble, VISITOR_PANEL_COPY, VisitorHandoff } from "./chat-panel";
import type { ChatMessage } from "./use-chat";

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

// Words and links meant for the business owner, never for their customers.
const OWNER_SPEAK =
  /your docs|knowledge base|Knowledge ready|Needs docs|Support widget|ticket|escalat|RAG pipeline/i;
const DASHBOARD_LINK = /href="\/(tickets|widget\/intake|inbox|knowledge)/;

function handoff(props: Partial<Parameters<typeof VisitorHandoff>[0]> = {}) {
  return renderToString(
    createElement(VisitorHandoff, {
      hasConversation: true,
      canEscalate: true,
      isEscalating: false,
      escalatedTicketId: null,
      escalatedEmail: null,
      publicDemo: false,
      visitorEmail: "pat@example.com",
      onVisitorEmailChange: () => {},
      onEscalate: () => {},
      ...props,
    }),
  );
}

function bubble(message: ChatMessage, audience: "staff" | "visitor") {
  return renderToString(createElement(MessageBubble, { message, audience }));
}

const fromDocs: ChatMessage = {
  id: "m1",
  role: "assistant",
  content: "Full refunds are available within 14 days.",
  sources: [{ documentTitle: "Refunds", content: "Refunds within 14 days." }],
  persisted: false,
};
const notInDocs: ChatMessage = {
  id: "m2",
  role: "assistant",
  content: "I don't have information about the Austin office.",
  sources: [],
  persisted: false,
};

describe("widget header for visitors", () => {
  it("names the business and shows no knowledge badge", () => {
    const html = render({ ...widget, organizationName: "Harbor Plumbing" });
    expect(html).toContain("Harbor Plumbing");
    expect(html).toContain(VISITOR_PANEL_COPY.subtitle.replace("'", "&#x27;"));
    expect(html).not.toMatch(OWNER_SPEAK);
    expect(html).not.toMatch(DASHBOARD_LINK);
  });

  it("falls back to a plain title without a name", () => {
    expect(render(widget)).toContain(`>${VISITOR_PANEL_COPY.fallbackTitle}<`);
  });

  it("speaks plainly on the help center channel too", () => {
    const html = render({ ...widget, widgetChannel: "HELP_CENTER", organizationName: "Harbor" });
    expect(html).not.toMatch(OWNER_SPEAK);
  });

  it("keeps the staff header in the owner's admin chat", () => {
    const html = render();
    expect(html).toContain("AI Support Chat");
    expect(html).toContain("Knowledge ready");
  });
});

describe("answer labels", () => {
  it("never tells a visitor about 'your docs'", () => {
    const answered = bubble(fromDocs, "visitor");
    expect(answered).toContain("From our help pages");
    expect(answered).toContain("Refunds within 14 days.");
    expect(answered).not.toMatch(OWNER_SPEAK);

    const missed = bubble(notInDocs, "visitor");
    expect(missed).toContain("I don&#x27;t have that in our help pages. A person can pick this up.");
    expect(missed).not.toMatch(OWNER_SPEAK);
  });

  it("keeps the staff labels in the owner's chat", () => {
    expect(bubble(fromDocs, "staff")).toContain("Answered from your docs");
    expect(bubble(notInDocs, "staff")).toContain("Not in your docs. A person can take this.");
  });

  it("does not label the hand-off confirmation as a missed answer", () => {
    const html = bubble(
      { id: "n1", role: "assistant", content: "Thanks. A person has this conversation.", notice: true },
      "visitor",
    );
    expect(html).not.toContain("help pages");
  });
});

describe("visitor hand-off", () => {
  it("shows the pending state, not the ask-first hint, while the request is in flight", () => {
    const html = handoff({ canEscalate: false, isEscalating: true });
    expect(html).toContain(VISITOR_PANEL_COPY.pending);
    expect(html).not.toContain(VISITOR_PANEL_COPY.askFirst);
    expect(html).not.toContain("Send a message first");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("still shows the pending state if the conversation id is missing mid-flight", () => {
    const html = handoff({ hasConversation: false, canEscalate: false, isEscalating: true });
    expect(html).toContain(VISITOR_PANEL_COPY.pending);
    expect(html).not.toContain(VISITOR_PANEL_COPY.askFirst);
  });

  it("asks for a question first only before there is a conversation", () => {
    const html = handoff({ hasConversation: false, canEscalate: false });
    expect(html).toContain(VISITOR_PANEL_COPY.askFirst);
    expect(html).not.toContain(VISITOR_PANEL_COPY.askButton);
  });

  it("says who replies and where, with no dashboard links", () => {
    const html = handoff({
      escalatedTicketId: "ticket_123",
      escalatedEmail: "pat@example.com",
    });
    expect(html).toContain("A person has this conversation.");
    expect(html).toContain("We&#x27;ll reply to pat@example.com.");
    expect(html).not.toMatch(DASHBOARD_LINK);
    expect(html).not.toMatch(/Open the case|Open the run log|ticket_123/);
  });

  it("keeps only the run log link in the public demo", () => {
    const html = handoff({ escalatedTicketId: "ticket_123", publicDemo: true });
    expect(html).toContain('href="/widget/intake"');
    expect(html).not.toContain("/tickets/");
    expect(html).not.toContain("We&#x27;ll reply");
  });
});
