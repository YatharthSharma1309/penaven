export function demoSeedDeniedMessage() {
  return process.env.DEMO_SEED_SECRET
    ? "Missing or incorrect demo seed secret."
    : "Demo seed is disabled in production without DEMO_SEED_SECRET.";
}

export function isDemoSeedAllowed(request: Request) {
  const secret = process.env.DEMO_SEED_SECRET;

  if (process.env.NODE_ENV === "production" && !secret) {
    return false;
  }

  if (secret && request.headers.get("x-demo-seed-secret") === secret) {
    return true;
  }

  if (process.env.NODE_ENV === "development" && !secret) {
    return true;
  }

  return false;
}
