import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import { pricingPlans, proAnswersPerDay } from "./pricing-section";

describe("pricingPlans", () => {
  const plans = pricingPlans({ demoMode: false, primaryHref: "/sign-up" });

  it("shows Free and Pro only", () => {
    expect(plans.map((plan) => plan.name)).toEqual(["Free", "Pro"]);
  });

  it("lists Analytics and Shortlist export on both plans", () => {
    expect(plans[0].features).toEqual([
      `${PLANS.free.assistantAnswersPerMonth} assistant answers / month`,
      `${PLANS.free.resumeScreensPerMonth} resume screens / month`,
      `${PLANS.free.roles} role`,
      "Analytics",
      "Shortlist export",
    ]);
    expect(plans[0].tagline).toBe("Try it on your FAQ and one open role.");
    expect(plans[1].features).toEqual(
      expect.arrayContaining(["Analytics", "Shortlist export"]),
    );
  });

  it("derives answers a day from PLANS and says billing is not on", () => {
    expect(proAnswersPerDay).toBe(Math.round(PLANS.pro.assistantAnswersPerMonth / 30));
    const pro = plans[1];
    expect(pro.tagline).toMatch(new RegExp(`^About ${proAnswersPerDay} answers a day`));
    expect(pro.note).toBe("Billing isn't on yet. Every workspace starts on Free.");
    expect(pro.cta).toBe("Start on Free");
    expect(pro.href).toBe("/sign-up");
    expect(pro.recommended).toBe(true);
  });

  it("keeps the demo CTAs in demo mode", () => {
    const demo = pricingPlans({ demoMode: true, primaryHref: "/dashboard" });
    expect(demo.map((plan) => [plan.cta, plan.href])).toEqual([
      ["Open live demo", "/dashboard"],
      ["Try the demo path", "/#try-demo"],
    ]);
  });
});
