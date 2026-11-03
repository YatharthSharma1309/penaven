import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ticketCreate = vi.hoisted(() =>
  vi.fn(async ({ data }) => ({ id: "ticket_1", status: "OPEN", ...data })),
);

vi.mock("@/lib/db", () => ({ db: { ticket: { create: ticketCreate } } }));
vi.mock("@/lib/auth/widget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/widget")>()),
  resolveWidgetOrganization: vi.fn(async () => ({ id: "org_demo" })),
}));
vi.mock("@/lib/auth/widget-visitor", () => ({
  assertWidgetVisitor: vi.fn(() => "visitor_1"),
}));

import { POST } from "./route";

function ticketRequest() {
  return new Request("http://localhost/api/widget/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Widget-Key": "wk_test" },
    body: JSON.stringify({
      title: "Late order",
      description: "Where is it?",
      requesterEmail: "visitor@example.com",
      requesterName: "A Visitor",
      visitorId: "visitor_1",
      visitorToken: "token",
    }),
  });
}

beforeEach(() => {
  ticketCreate.mockClear();
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("widget ticket requester details", () => {
  it("stores no email or name in the public demo", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    const response = await POST(ticketRequest());

    expect(response.status).toBe(200);
    expect(ticketCreate.mock.calls[0][0].data).toMatchObject({
      requesterEmail: null,
      requesterName: null,
    });
    const { ticket } = await response.json();
    expect(JSON.stringify(ticket)).not.toContain("visitor@example.com");
  });

  it("keeps them for a real workspace", async () => {
    const response = await POST(ticketRequest());

    expect(response.status).toBe(200);
    expect(ticketCreate.mock.calls[0][0].data).toMatchObject({
      requesterEmail: "visitor@example.com",
      requesterName: "A Visitor",
    });
  });
});
