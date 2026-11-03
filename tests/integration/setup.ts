import { vi } from "vitest";
import { assertIntegrationEnv } from "./env-guard";

assertIntegrationEnv();

// Nothing here may reach a model, Redis, Clerk or an evidence sink, even if the
// shell that started the run has keys in it.
for (const name of [
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_EMBEDDING_MODEL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CLERK_SECRET_KEY",
  "OPS_WORKER_URL",
  "FIREBASE_DATABASE_URL",
]) {
  delete process.env[name];
}

process.env.WIDGET_VISITOR_SECRET = "integration-only-not-a-real-secret";
process.env.APP_URL = "http://localhost:3000";

vi.stubGlobal("fetch", async (input: unknown) => {
  throw new Error(`The integration suite must not use the network: ${String(input)}`);
});

vi.mock("@clerk/nextjs/server", async () => {
  const { clerkAuth, clerkCurrentUser } = await import("./helpers/session");
  return {
    auth: clerkAuth,
    currentUser: clerkCurrentUser,
    // Both workspaces are seeded with a clerkOrgId, so this is never reached.
    clerkClient: async () => {
      throw new Error("The integration suite must not call Clerk.");
    },
  };
});
