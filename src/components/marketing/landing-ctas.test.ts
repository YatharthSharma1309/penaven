import { describe, expect, it } from "vitest";
import { PUBLIC_DEMO_HIRING_PATH, demoCandidates } from "@/lib/recruitment/demo-sample";
import {
  landingCtas,
  SAMPLE_COMPARE_HREF,
  SAMPLE_SHORTLIST_HREF,
} from "./landing-ctas";
import { OPS_LANES, opsLaneCta } from "./ops-lanes";
import { buildSteps, WORKSPACE_ONLY_NOTE } from "./product-demo-walkthrough";

function allHrefs(ctas: ReturnType<typeof landingCtas>) {
  return [
    ctas.hero.primary,
    ctas.hero.secondary,
    ...ctas.howItWorks,
    ctas.closing.primary,
    ctas.closing.secondary,
    ctas.footerBand.primary,
    ctas.footerBand.secondary,
  ];
}

describe("sample links", () => {
  it("point at the public hiring sample and real sample candidates", () => {
    expect(SAMPLE_SHORTLIST_HREF).toBe(PUBLIC_DEMO_HIRING_PATH);
    const ids = new URL(SAMPLE_COMPARE_HREF, "http://x").searchParams
      .get("ids")!
      .split(",");
    const known = demoCandidates.map((candidate) => candidate.id);
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) expect(known).toContain(id);
  });
});

describe("landingCtas with demo mode off", () => {
  const ctas = landingCtas(false);

  it("keeps Get started free on the hero and closing CTA only", () => {
    expect(ctas.hero.primary).toEqual({ href: "/sign-up", label: "Get started free" });
    expect(ctas.closing.primary).toEqual({ href: "/sign-up", label: "Get started free" });
    const signUps = allHrefs(ctas).filter((cta) => cta.href === "/sign-up");
    expect(signUps).toHaveLength(2);
  });

  it("offers the public sample from the hero and the footer band", () => {
    expect(ctas.hero.secondary).toEqual({
      href: "/demo/hiring",
      label: "See a sample shortlist",
    });
    expect(ctas.footerBand.primary.href).toBe("/demo/hiring");
  });

  it("sends How it works to the walkthrough, not sign-up", () => {
    expect(ctas.howItWorks.map((cta) => cta.href)).toEqual(["/#try-demo", "/help"]);
  });
});

describe("landingCtas with demo mode on", () => {
  it("keeps the demo targets", () => {
    const ctas = landingCtas(true);
    expect(ctas.hero.primary).toEqual({ href: "/dashboard", label: "Open live demo" });
    expect(ctas.hero.secondary).toEqual({ href: "/#try-demo", label: "Explore the demo" });
    expect(ctas.howItWorks).toEqual([
      { href: "/#try-demo", label: "Open interactive demo" },
    ]);
    expect(ctas.closing.secondary).toEqual({ href: "/#how-it-works", label: "How it works" });
    expect(ctas.footerBand).toEqual({
      primary: { href: "/dashboard", label: "Open live demo" },
      secondary: { href: "/widget", label: "Support widget" },
    });
    expect(allHrefs(ctas).some((cta) => cta.href === "/sign-up")).toBe(false);
  });
});

describe("walkthrough steps", () => {
  it("never sends a step to sign-up when demo mode is off", () => {
    const steps = buildSteps(false);
    expect(steps.map((step) => step.href)).toEqual([
      null,
      null,
      null,
      null,
      SAMPLE_COMPARE_HREF,
    ]);
    expect(steps.at(-1)?.cta).toBe("Open the sample compare");
    expect(WORKSPACE_ONLY_NOTE).toMatch(/Create a workspace to try this/);
  });

  it("keeps the product pages in demo mode", () => {
    expect(buildSteps(true).map((step) => [step.href, step.cta])).toEqual([
      ["/knowledge", "Open knowledge"],
      ["/widget", "Open the site chat"],
      ["/inbox", "Open the inbox"],
      ["/analytics#knowledge-gaps", "Open knowledge gaps"],
      ["/demo/hiring/compare?ids=maya-chen,jordan-ellis", "Open the sample compare"],
    ]);
  });
});

describe("opsLaneCta", () => {
  it("uses public pages when demo mode is off", () => {
    expect(OPS_LANES.map((lane) => opsLaneCta(lane, false))).toEqual([
      { href: "/#try-demo", label: "Walk the support steps" },
      { href: "/demo/hiring", label: "See a sample shortlist" },
    ]);
  });

  it("uses the product pages in demo mode", () => {
    expect(OPS_LANES.map((lane) => opsLaneCta(lane, true))).toEqual(
      OPS_LANES.map((lane) => ({ href: lane.demoHref, label: lane.demoCta })),
    );
  });
});
