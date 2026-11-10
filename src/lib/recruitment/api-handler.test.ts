import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  withOrgMembership: vi.fn(async () => {
    throw new Error("org lookup should not run in the public demo");
  }),
}));

const {
  DEMO_RECRUITMENT_READ_MESSAGE,
  DEMO_RECRUITMENT_WRITE_MESSAGE,
  withRecruitmentOrg,
} = await import("@/lib/recruitment/api-handler");

describe("withRecruitmentOrg in the public demo", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks writes with the write message", async () => {
    const handler = vi.fn();
    const response = (await withRecruitmentOrg(handler)) as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: DEMO_RECRUITMENT_WRITE_MESSAGE,
      code: "DEMO_READ_ONLY",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks reads with a message that fits a read", async () => {
    const handler = vi.fn();
    const response = (await withRecruitmentOrg(handler, "read")) as Response;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: DEMO_RECRUITMENT_READ_MESSAGE, code: "DEMO_READ_ONLY" });
    expect(body.error).not.toMatch(/upload|changes/i);
    expect(handler).not.toHaveBeenCalled();
  });
});
