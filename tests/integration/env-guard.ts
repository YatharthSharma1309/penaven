/** Anything that would swap the real sign-in or the real plan limits for a stand-in. */
export const BYPASS_ENV_VARS = [
  "AUTH_BYPASS",
  "NEXT_PUBLIC_AUTH_BYPASS",
  "E2E_AUTH_BYPASS",
  "PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_PUBLIC_DEMO_MODE",
] as const;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function databaseUrlProblem(value: string | undefined): string | null {
  if (!value) return "DATABASE_URL is not set.";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "DATABASE_URL is not a valid URL.";
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return "DATABASE_URL must be a postgres:// or postgresql:// URL.";
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    return "DATABASE_URL must point at localhost or 127.0.0.1.";
  }

  // The pg driver lets these override the host in the URL.
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) {
    return "DATABASE_URL must not name another host in its query string.";
  }

  return null;
}

/** Reasons this environment must not run the suite. Empty means it may. */
export function integrationEnvProblems(env: Record<string, string | undefined>) {
  const problems: string[] = [];

  const database = databaseUrlProblem(env.DATABASE_URL);
  if (database) problems.push(database);

  for (const name of BYPASS_ENV_VARS) {
    if (env[name]) problems.push(`${name} must be unset.`);
  }

  if (env.NODE_ENV === "production") {
    problems.push("NODE_ENV must not be production.");
  }

  return problems;
}

export function assertIntegrationEnv(
  env: Record<string, string | undefined> = process.env,
) {
  const problems = integrationEnvProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to run the integration suite:\n- ${problems.join("\n- ")}`,
    );
  }
}
