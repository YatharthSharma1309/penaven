import type { LocalizationResource } from "@clerk/shared/types";

/**
 * Clerk cards stay light in both site themes. Clerk 7 reads the variables
 * below (colorText is gone); colorForeground defaults to `inherit`, which
 * picked up the dark theme's white body text inside the white card. Every
 * colour is set explicitly, and `color-scheme: light` stops the site's dark
 * scheme from darkening native input and autofill styles in the card.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#312e81",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "#0f172a",
    colorMutedForeground: "#475569",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0f172a",
    colorNeutral: "#0f172a",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  elements: {
    rootBox: "[color-scheme:light]",
    cardBox: "[color-scheme:light]",
    userButtonPopoverCard: "[color-scheme:light]",
    organizationSwitcherPopoverCard: "[color-scheme:light]",
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
