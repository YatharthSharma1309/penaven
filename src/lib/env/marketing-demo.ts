import { hiringWorkspaceHref } from "@/lib/env/public-demo";

/** Client-safe: only treat as demo when auth bypass is actually enabled. */
export function isMarketingDemoMode() {
  return process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
}

/** Icon keys map to lucide icons in `DemoShortcuts` — keep this module React-free. */
export type DemoModuleIcon = "dashboard" | "widget" | "hiring" | "analytics";

export type DemoModuleLink = {
  href: string;
  label: string;
  hint: string;
  icon: DemoModuleIcon;
};

export const demoModuleLinks: readonly DemoModuleLink[] = [
  {
    href: "/dashboard",
    label: "Home",
    hint: "Start here — inbox and the next step",
    icon: "dashboard",
  },
  {
    href: "/widget",
    label: "Support widget",
    hint: "Website chat that cites your docs",
    icon: "widget",
  },
  {
    href: hiringWorkspaceHref(),
    label: "Hiring lane",
    hint: "Maya, Jordan, and Priya — the lines, then you decide",
    icon: "hiring",
  },
  {
    href: "/analytics",
    label: "Analytics",
    hint: "What the inbox and the shortlist did",
    icon: "analytics",
  },
] as const;
