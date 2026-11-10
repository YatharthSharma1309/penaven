import type { Metadata } from "next";

/** Signed-in screens, auth, and embeds stay out of search results. */
export const privatePageRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/** Paths crawlers are told to skip in robots.txt. */
export const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/dashboard",
  "/inbox",
  "/tickets",
  "/knowledge",
  "/widget",
  "/analytics",
  "/hiring",
  "/recruitment",
  "/settings",
  "/chat",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/share/",
] as const;

/** Public pages crawlers may index. */
export const PUBLIC_PATH_PREFIXES = ["/", "/help", "/contact", "/demo"] as const;
