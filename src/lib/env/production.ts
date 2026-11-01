import { isAiConfigured } from "@/lib/ai";
import { isPublicDemoMode } from "@/lib/env/public-demo";

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.CI === "true" && process.env.AUTH_BYPASS === "true") return;

  const missing: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (!process.env.APP_URL?.trim()) missing.push("APP_URL");

  if (isPublicDemoMode()) {
    if (!process.env.OPENROUTER_API_KEY?.trim()) missing.push("OPENROUTER_API_KEY");
    if (!process.env.DEMO_SEED_SECRET?.trim()) missing.push("DEMO_SEED_SECRET");
    if (
      process.env.AUTH_BYPASS !== "true" ||
      process.env.NEXT_PUBLIC_AUTH_BYPASS !== "true"
    ) {
      throw new Error(
        "PUBLIC_DEMO_MODE requires AUTH_BYPASS=true and NEXT_PUBLIC_AUTH_BYPASS=true.",
      );
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required public-demo environment variables: ${missing.join(", ")}`,
      );
    }
    console.warn(
      "[OpsConcierge] PUBLIC_DEMO_MODE is enabled — Clerk auth is bypassed. Use Clerk keys for real production.",
    );
    return;
  }

  if (!process.env.CLERK_SECRET_KEY?.trim()) missing.push("CLERK_SECRET_KEY");
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }

  if (
    process.env.AUTH_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"
  ) {
    throw new Error("AUTH_BYPASS cannot be enabled in production.");
  }

  if (!process.env.WIDGET_VISITOR_SECRET?.trim()) {
    throw new Error(
      "WIDGET_VISITOR_SECRET is required in production for secure widget visitor sessions.",
    );
  }

  if (
    !process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  ) {
    console.warn(
      "[OpsConcierge] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limits are per-instance only.",
    );
  }

  if (!isAiConfigured()) {
    console.warn(
      "[OpsConcierge] No AI provider key set (OPENROUTER_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY) — chat cannot answer and will hand visitors to a person.",
    );
  }
}
