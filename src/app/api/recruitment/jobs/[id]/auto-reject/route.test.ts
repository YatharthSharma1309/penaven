import { beforeEach, describe, expect, it, vi } from "vitest";

/** Drives the real POST handler with the org check and the service mocked. */

const state = vi.hoisted(() => ({
  role: "ADMIN" as "ADMIN" | "MEMBER",
  calls: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/recruitment/api-handler", () => ({
  withRecruitmentOrg: async (
    handler: (context: { organization: { id: string }; user: { id: string }; role: string }) => unknown,
  ) => handler({ organization: { id: "org_1" }, user: { id: "user_1" }, role: state.role }),
}));

vi.mock("@/lib/recruitment/services/auto-reject", () => ({
  setAutoReject: vi.fn(async (input: Record<string, unknown>) => {
    state.calls.push(input);
    return true;
  }),
}));

const { POST } = await import("@/app/api/recruitment/jobs/[id]/auto-reject/route");

function post(body: unknown) {
  const request = new Request("http://localhost/api/recruitment/jobs/job_1/auto-reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id: "job_1" }) });
}

beforeEach(() => {
  state.role = "ADMIN";
  state.calls = [];
});

describe("POST /api/recruitment/jobs/[id]/auto-reject", () => {
  it("turns on with the Contradicts-only mode when no mode is sent", async () => {
    const response = await post({ enabled: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ autoRejectEnabled: true, autoRejectMode: "contradicts" });
    expect(state.calls[0]).toMatchObject({ enabled: true, mode: "contradicts", jobId: "job_1" });
  });

  it("stores the wider mode when an admin picks it", async () => {
    const response = await post({ enabled: true, mode: "missing_or_contradicts" });
    expect(response.status).toBe(200);
    expect(state.calls[0]).toMatchObject({ enabled: true, mode: "missing_or_contradicts" });
  });

  it("rejects an unknown mode without saving", async () => {
    const response = await post({ enabled: true, mode: "low_score" });
    expect(response.status).toBe(400);
    expect(state.calls).toHaveLength(0);
  });

  it("turns off without touching the mode", async () => {
    const response = await post({ enabled: false });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ autoRejectEnabled: false });
    expect(state.calls[0]).toMatchObject({ enabled: false, mode: undefined });
  });

  it("is admin only", async () => {
    state.role = "MEMBER";
    const response = await post({ enabled: true });
    expect(response.status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });
});
