import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const SECRET = "customer-secret@example.test";

const mocks = vi.hoisted(() => ({ requireOrgMembership: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  authErrorResponse: () => null,
  getOrgMembershipContext: vi.fn(),
  requireOrgMembership: mocks.requireOrgMembership,
  requireOrgMembershipOrRedirect: vi.fn(),
}));

import { withAdminMembership, withOrgMembership } from "@/lib/auth/api";

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Failed with ${SECRET}`, {
    code,
    clientVersion: "7.8.0",
    meta: { modelName: "Ticket" },
  });
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.requireOrgMembership.mockResolvedValue({ organization: { id: "org_1" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ["withOrgMembership", withOrgMembership],
  ["withAdminMembership", withAdminMembership],
])("%s", (_name, wrap) => {
  it("reports an outage as 503, not a broken constraint", async () => {
    const response = (await wrap(async () => {
      throw known("P1001");
    })) as Response;
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(text).not.toMatch(/constraint/i);
    expect(text).not.toContain(SECRET);
  });

  it("logs the code and model of a mapped error, which it did not before", async () => {
    await wrap(async () => {
      throw known("P2002");
    });

    expect(errorLog).toHaveBeenCalledWith("Database error", {
      code: "P2002",
      model: "Ticket",
      status: 409,
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  });

  it("reports a missing record as 404", async () => {
    const response = (await wrap(async () => {
      throw known("P2025");
    })) as Response;

    expect(response.status).toBe(404);
  });

  it("reports schema drift as 500", async () => {
    const response = (await wrap(async () => {
      throw known("P2022");
    })) as Response;

    expect(response.status).toBe(500);
  });

  it("maps a failure during the membership lookup", async () => {
    mocks.requireOrgMembership.mockRejectedValueOnce(known("P1001"));
    const response = (await wrap(async () => "unused")) as Response;

    expect(response.status).toBe(503);
  });

  it("keeps the existing reply for other errors", async () => {
    const response = (await wrap(async () => {
      throw new Error("Something else");
    })) as Response;

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});
