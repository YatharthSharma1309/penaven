import { describe, expect, it } from "vitest";
import {
  PLANS,
  assistantCapReply,
  isAtMonthlyCap,
  planForWorkspace,
  proHeavyMonthUsd,
  startOfUtcMonth,
} from "@/lib/billing/plans";

describe("plans", () => {
  it("publishes one Pro price inside $29–$49", () => {
    expect(PLANS.pro.priceUsd).toBe(39);
    expect(PLANS.pro.priceUsd).toBeGreaterThanOrEqual(29);
    expect(PLANS.pro.priceUsd).toBeLessThanOrEqual(49);
  });

  it("keeps a heavy Pro month under the price", () => {
    expect(proHeavyMonthUsd()).toBeLessThan(PLANS.pro.priceUsd);
    expect(proHeavyMonthUsd()).toBeLessThan(24);
  });

  it("leaves the public demo uncapped and other workspaces on Free", () => {
    expect(planForWorkspace({ publicDemo: true })).toBeNull();
    expect(planForWorkspace({ publicDemo: false })).toEqual(PLANS.free);
  });

  it("treats the cap as used once the count reaches it", () => {
    expect(isAtMonthlyCap(39, 40)).toBe(false);
    expect(isAtMonthlyCap(40, 40)).toBe(true);
  });

  it("starts the month on the first UTC day", () => {
    expect(startOfUtcMonth(new Date("2026-10-21T18:30:00.000Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("tells a widget visitor to ask for a person when the cap is hit", () => {
    expect(assistantCapReply("WIDGET")).toMatch(/Ask a person to take this/);
    expect(assistantCapReply("ADMIN")).toContain("$39");
    expect(assistantCapReply("ADMIN")).toContain("250");
  });
});
