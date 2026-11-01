import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const demoContext = vi.hoisted(() => ({
  organization: { id: "org_demo" },
  user: { id: "user_demo" },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth/demo", () => ({
  ensureUniqueOrgSlug: vi.fn(),
  generateWidgetPublicKey: vi.fn(),
  slugifyOrgName: vi.fn(),
  getDemoOrganizationContext: vi.fn(async () => demoContext),
}));

import {
  getOrgMembershipContext,
  requireOrgMembership,
  requireOrgMembershipOrRedirect,
} from "./session";

beforeEach(() => {
  vi.stubEnv("PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("E2E_AUTH_BYPASS", "");
  vi.stubEnv("AUTH_BYPASS", "true");
  vi.stubEnv("NEXT_PUBLIC_AUTH_BYPASS", "true");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => vi.unstubAllEnvs());

describe("bypass role", () => {
  it("makes a public demo visitor an agent", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    expect((await getOrgMembershipContext())?.role).toBe("AGENT");
  });

  it("keeps admin for the e2e bypass", async () => {
    vi.stubEnv("E2E_AUTH_BYPASS", "true");
    expect((await getOrgMembershipContext())?.role).toBe("ADMIN");
  });

  it("stays an agent if a demo deploy also sets the e2e bypass", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("E2E_AUTH_BYPASS", "true");
    expect((await getOrgMembershipContext())?.role).toBe("AGENT");
  });

  it("refuses admin routes and sends the settings page to the dashboard", async () => {
    vi.stubEnv("PUBLIC_DEMO_MODE", "true");
    await expect(requireOrgMembership("ADMIN")).rejects.toThrow("Admin access required.");
    await expect(requireOrgMembershipOrRedirect("ADMIN")).rejects.toThrow("redirect:/dashboard");
  });
});
