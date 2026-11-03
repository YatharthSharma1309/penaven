import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost" })),
}));
vi.mock("@/components/widget/floating-widget", () => ({ FloatingWidget: "floating-widget" }));
vi.mock("@/lib/auth/widget", () => ({
  resolveWidgetOrganization: vi.fn(async () => ({ id: "org_1", name: "Harbor Plumbing" })),
}));
vi.mock("@/lib/db", () => ({ db: { document: { count: vi.fn(async () => 1) } } }));
vi.mock("@/lib/settings", () => ({
  getAgentSettings: vi.fn(async () => ({ greeting: "Hi" })),
}));

import WidgetEmbedPage from "./page";

async function widgetProps(searchParams: Record<string, string>) {
  const page = (await WidgetEmbedPage({
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
  return page.props.children.props;
}

describe("widget embed page", () => {
  it("does not open or ask anything from ?q=", async () => {
    const props = await widgetProps({ key: "wk_test", q: "Spend this workspace's answers" });

    expect(props.widgetKey).toBe("wk_test");
    expect(props).not.toHaveProperty("initialQuestion");
    expect(props).not.toHaveProperty("defaultOpen");
    expect(JSON.stringify(props)).not.toContain("Spend this");
  });

  it("still reads the channel", async () => {
    const props = await widgetProps({ key: "wk_test", channel: "help" });
    expect(props.widgetChannel).toBe("HELP_CENTER");
  });

  it("passes the business's name for the visitor header", async () => {
    const props = await widgetProps({ key: "wk_test" });
    expect(props.organizationName).toBe("Harbor Plumbing");
  });
});
