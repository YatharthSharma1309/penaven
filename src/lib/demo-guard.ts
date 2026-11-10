export function demoSeedDeniedMessage() {
  return process.env.DEMO_SEED_SECRET
    ? "Missing or incorrect demo seed secret."
    : "Demo seed is disabled in production without DEMO_SEED_SECRET.";
}

/**
 * True when a plain browser click on "Load sample data" can succeed: the
 * browser never sends x-demo-seed-secret, so it only works in development
 * with no secret set and the dev auth bypass on.
 */
export function canSeedFromBrowser() {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.DEMO_SEED_SECRET &&
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"
  );
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
