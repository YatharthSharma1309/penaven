import type { LocalizationResource } from "@clerk/shared/types";

export const clerkAppearance = {
  variables: {
    colorPrimary: "#312e81",
    colorText: "#0f172a",
    colorBackground: "#ffffff",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  elements: {
    card: "shadow-lg border border-slate-200 pb-8",
    footer: "pb-2",
    formButtonPrimary:
      "bg-[#312e81] hover:bg-[#3730a3] text-white rounded-xl",
    organizationSwitcherTrigger: "rounded-xl border border-slate-200",
  },
};

export const clerkLocalization: LocalizationResource = {
  signIn: {
    start: {
      title: "Sign in to Penaven",
      subtitle: "Use the email for your workspace.",
    },
    password: {
      title: "Enter your password",
      subtitle: "This continues into your Penaven workspace.",
    },
  },
  signUp: {
    start: {
      title: "Create your Penaven workspace",
      subtitle: "A new workspace starts on Free.",
    },
  },
};
