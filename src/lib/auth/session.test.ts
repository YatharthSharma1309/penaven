import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const EMAIL = "person@example.test";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getOrganization: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  db: {
    user: { upsert: vi.fn(), findUnique: vi.fn() },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: { upsert: vi.fn() },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
  clerkClient: async () => ({
    organizations: { getOrganization: mocks.getOrganization },
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/bypass", () => ({ isAuthBypassEnabled: () => false }));

import {
  AuthError,
  authErrorResponse,
  requireOrgMembership,
  requireOrgMembershipOrRedirect,
} from "@/lib/auth/session";

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Failed for ${EMAIL}`, {
    code,
    clientVersion: "7.8.0",
    meta: { modelName: "User" },
  });
}

const userRow = { id: "user_1", clerkUserId: "clerk_1", email: "old@example.test" };
const orgRow = { id: "org_1", clerkOrgId: "clerk_org_1", widgetPublicKey: "wk" };

let warnLog: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

  mocks.auth.mockResolvedValue({
    userId: "clerk_1",
    orgId: "clerk_org_1",
    orgRole: "org:admin",
  });
  mocks.currentUser.mockResolvedValue({
    id: "clerk_1",
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: EMAIL }],
    firstName: "A",
    lastName: "B",
    imageUrl: null,
  });
  mocks.getOrganization.mockResolvedValue({ name: "Acme" });
  mocks.db.user.upsert.mockReset().mockResolvedValue(userRow);
  mocks.db.user.findUnique.mockReset().mockResolvedValue(null);
  mocks.db.organization.findUnique.mockReset().mockImplementation(
    async ({ where }: { where: { clerkOrgId?: string } }) =>
      where.clerkOrgId ? orgRow : null,
  );
  mocks.db.organization.create.mockReset().mockResolvedValue(orgRow);
  mocks.db.organizationMember.upsert
    .mockReset()
    .mockResolvedValue({ role: "ADMIN" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("user sync when the upsert hits a unique clash", () => {
  it("keeps working from the existing row", async () => {
    mocks.db.user.upsert.mockRejectedValueOnce(known("P2002"));
    mocks.db.user.findUnique.mockResolvedValueOnce(userRow);

    const context = await requireOrgMembership();

    expect(context.user).toBe(userRow);
    expect(mocks.db.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_1" },
    });
  });

  it("gives a clear account error when no row belongs to this login", async () => {
    mocks.db.user.upsert.mockRejectedValueOnce(known("P2002"));

    const error = await requireOrgMembership().catch((caught) => caught);

    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe("ACCOUNT_CONFLICT");

    const response = authErrorResponse(error);
    expect(response?.status).toBe(409);
    expect((await response?.json()).error).toMatch(/already linked/);
  });

  it("does not relink the row that holds the email", async () => {
    mocks.db.user.upsert.mockRejectedValueOnce(known("P2002"));

    await requireOrgMembership().catch(() => null);

    expect(mocks.db.user.upsert).toHaveBeenCalledTimes(1);
  });

  it("never logs the email", async () => {
    mocks.db.user.upsert.mockRejectedValue(known("P2002"));
    await requireOrgMembership().catch(() => null);

    mocks.db.user.findUnique.mockResolvedValueOnce(userRow);
    await requireOrgMembership();

    const logged = JSON.stringify([...warnLog.mock.calls, ...errorLog.mock.calls]);
    expect(logged).toContain("P2002");
    expect(logged).not.toContain(EMAIL);
  });

  it("does not redirect pages, because sign-in would send them straight back", async () => {
    mocks.db.user.upsert.mockRejectedValueOnce(known("P2002"));

    const error = await requireOrgMembershipOrRedirect().catch((caught) => caught);

    expect(error.code).toBe("ACCOUNT_CONFLICT");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not hide an outage", async () => {
    const outage = known("P1001");
    mocks.db.user.upsert.mockRejectedValueOnce(outage);

    await expect(requireOrgMembership()).rejects.toBe(outage);
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("organization sync when the create hits a unique clash", () => {
  beforeEach(() => {
    mocks.db.organization.findUnique.mockReset().mockResolvedValue(null);
  });

  it("uses the org a parallel request created", async () => {
    mocks.db.organization.create.mockRejectedValueOnce(known("P2002"));
    mocks.db.organization.findUnique.mockImplementation(
      async ({ where }: { where: { clerkOrgId?: string } }) =>
        where.clerkOrgId && mocks.db.organization.create.mock.calls.length > 0
          ? orgRow
          : null,
    );

    const context = await requireOrgMembership();

    expect(context.organization).toBe(orgRow);
    expect(mocks.db.organization.create).toHaveBeenCalledTimes(1);
  });

  it("retries once when another org took the slug", async () => {
    mocks.db.organization.create.mockRejectedValueOnce(known("P2002"));

    const context = await requireOrgMembership();

    expect(context.organization).toBe(orgRow);
    expect(mocks.db.organization.create).toHaveBeenCalledTimes(2);
  });

  it("stops after one retry", async () => {
    const clash = known("P2002");
    mocks.db.organization.create.mockRejectedValue(clash);

    await expect(requireOrgMembership()).rejects.toBe(clash);
    expect(mocks.db.organization.create).toHaveBeenCalledTimes(2);
  });

  it("does not retry other failures", async () => {
    const outage = known("P1001");
    mocks.db.organization.create.mockRejectedValueOnce(outage);

    await expect(requireOrgMembership()).rejects.toBe(outage);
    expect(mocks.db.organization.create).toHaveBeenCalledTimes(1);
  });
});
