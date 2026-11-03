import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EscalationTriage } from "@/lib/tickets/escalation-triage";

/**
 * A visitor who asks for a person gets the ticket back without waiting for the
 * model triage. The triage and the run log entry run after the response.
 */

const mocks = vi.hoisted(() => ({
  afterTasks: [] as Array<() => Promise<void>>,
  triageEscalation: vi.fn(),
  ticketCreate: vi.fn(async ({ data }) => ({ id: "ticket_1", status: "OPEN", ...data })),
  ticketUpdate: vi.fn(async ({ where, data }) => ({
    id: where.id,
    status: "OPEN",
    ...data,
  })),
  logCreate: vi.fn(async () => ({})),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    mocks.afterTasks.push(task);
  },
}));
vi.mock("@/lib/tickets/escalation-triage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets/escalation-triage")>()),
  triageEscalation: mocks.triageEscalation,
}));
vi.mock("@/lib/db", () => ({
  db: {
    conversation: { findFirst: vi.fn(async () => ({ id: "conv_1" })) },
    ticket: {
      findFirst: vi.fn(async () => null),
      create: mocks.ticketCreate,
      update: mocks.ticketUpdate,
    },
    executionRun: {
      findFirst: vi.fn(async () => ({ id: "run_1", userMessageId: "msg_1" })),
    },
    executionLogEntry: { create: mocks.logCreate },
  },
}));
vi.mock("@/lib/auth/widget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/widget")>()),
  resolveWidgetOrganization: vi.fn(async () => ({ id: "org_1" })),
}));
vi.mock("@/lib/auth/widget-visitor", () => ({
  assertWidgetVisitor: vi.fn(() => "visitor_1"),
}));

import { POST } from "./route";
import { triageWithTimeout } from "@/lib/tickets/escalation-followup";

const AI_TRIAGE: EscalationTriage = {
  priority: "MEDIUM",
  category: "shipping",
  reasonCode: "late_delivery",
  brief: ["Order is late.", "Check tracking.", "Reply with a date."],
  model: "test-model",
  source: "ai",
};

function escalationRequest() {
  return new Request("http://localhost/api/widget/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Widget-Key": "wk_test" },
    body: JSON.stringify({
      title: "Escalation: Where is my package delivery?",
      description: "user: Where is my package delivery?\n\nassistant: I couldn't find that.",
      conversationId: "conv_1",
      requesterEmail: "visitor@example.com",
      visitorId: "visitor_1",
      visitorToken: "token",
    }),
  });
}

async function runAfterTasks() {
  for (const task of mocks.afterTasks.splice(0)) await task();
}

beforeEach(() => {
  mocks.afterTasks.length = 0;
  mocks.triageEscalation.mockReset();
  mocks.ticketCreate.mockClear();
  mocks.ticketUpdate.mockClear();
  mocks.logCreate.mockClear();
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("widget hand-off response time", () => {
  it("returns the ticket with keyword triage while the model triage is still running", async () => {
    // A model that never answers: the old route waited 8 s for its timeout.
    mocks.triageEscalation.mockReturnValue(new Promise(() => {}));

    const response = await POST(escalationRequest());

    expect(response.status).toBe(200);
    const { ticket } = await response.json();
    expect(ticket.id).toBe("ticket_1");
    expect(ticket.triage).toMatchObject({ source: "heuristic", category: "shipping" });
    expect(ticket.priority).toBe("MEDIUM");
    // The model triage and the run log wait for after the response.
    expect(mocks.afterTasks).toHaveLength(1);
    expect(mocks.triageEscalation).not.toHaveBeenCalled();
    expect(mocks.logCreate).not.toHaveBeenCalled();
  });

  it("applies the model triage and writes the run log after the response", async () => {
    mocks.triageEscalation.mockResolvedValue(AI_TRIAGE);

    await POST(escalationRequest());
    await runAfterTasks();

    expect(mocks.ticketUpdate).toHaveBeenLastCalledWith({
      where: { id: "ticket_1" },
      data: { priority: "MEDIUM", triage: AI_TRIAGE },
    });
    expect(mocks.logCreate).toHaveBeenCalledTimes(1);
    const [{ data }] = mocks.logCreate.mock.calls[0] as unknown as [
      { data: Record<string, unknown> & { metadata: Record<string, unknown> } },
    ];
    expect(data).toMatchObject({
      agent: "escalation-triage",
      model: "test-model",
      decision: "triage_ready",
    });
    expect(data.metadata).toMatchObject({
      ticketId: "ticket_1",
      category: "shipping",
      source: "ai",
    });
    expect(typeof data.metadata.responseMs).toBe("number");
  });

  it("keeps the keyword triage and logs it when the model gives nothing", async () => {
    mocks.triageEscalation.mockRejectedValue(new Error("model down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await POST(escalationRequest());
    await runAfterTasks();

    // Only the keyword attach before the response; no model update after it.
    expect(mocks.ticketUpdate).toHaveBeenCalledTimes(1);
    const [{ data }] = mocks.logCreate.mock.calls[0] as unknown as [
      { data: Record<string, unknown> & { metadata: Record<string, unknown> } },
    ];
    expect(data).toMatchObject({ agent: "escalation-triage", model: "heuristic" });
    expect(data.metadata).toMatchObject({ source: "heuristic", category: "shipping" });
  });
});

describe("triageWithTimeout", () => {
  it("gives up on a model that does not answer in time", async () => {
    mocks.triageEscalation.mockReturnValue(new Promise(() => {}));
    await expect(triageWithTimeout("Escalation: hi", "user: hi", 10)).resolves.toBeNull();
  });
});
