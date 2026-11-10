/**
 * Where the landing-page buttons go. With marketing demo mode off, the only
 * product screens a visitor can open without an account are the fictional
 * hiring sample under /demo/hiring, so the secondary buttons point there
 * instead of repeating "Get started free".
 */
export type LandingCta = { href: string; label: string };

export const SIGN_UP_HREF = "/sign-up";
/**
 * Same as PUBLIC_DEMO_HIRING_PATH in demo-sample.ts (a test checks), written out
 * so the landing page does not bundle the sample candidates.
 */
export const SAMPLE_SHORTLIST_HREF = "/demo/hiring";
export const SAMPLE_SHORTLIST_LABEL = "See a sample shortlist";
export const SAMPLE_COMPARE_HREF = `${SAMPLE_SHORTLIST_HREF}/compare?ids=maya-chen,jordan-ellis`;

export function landingCtas(demoMode: boolean) {
  const primary: LandingCta = demoMode
    ? { href: "/dashboard", label: "Open live demo" }
    : { href: SIGN_UP_HREF, label: "Get started free" };
  const sample: LandingCta = {
    href: SAMPLE_SHORTLIST_HREF,
    label: SAMPLE_SHORTLIST_LABEL,
  };

  return {
    primary,
    hero: {
      primary,
      secondary: demoMode
        ? { href: "/#try-demo", label: "Explore the demo" }
        : sample,
    },
    howItWorks: demoMode
      ? [{ href: "/#try-demo", label: "Open interactive demo" }]
      : [
          { href: "/#try-demo", label: "Walk the desk" },
          { href: "/help", label: "Help center" },
        ],
    closing: {
      primary,
      secondary: demoMode
        ? { href: "/#how-it-works", label: "How it works" }
        : { href: "/help", label: "Help center" },
    },
    footerBand: {
      primary: demoMode ? primary : sample,
      secondary: demoMode
        ? { href: "/widget", label: "Support widget" }
        : { href: "/help", label: "Help center" },
    },
  };
}
