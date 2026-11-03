/** Portfolio/recruiter demo deploy without Clerk — not for real multi-tenant production. */
export function isPublicDemoMode() {
  return (
    process.env.PUBLIC_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_PUBLIC_DEMO_MODE === "true"
  );
}

/** Public demo visitors review fictional candidates. Authenticated workspaces keep /recruitment. */
export function hiringWorkspaceHref() {
  return isPublicDemoMode() ? "/hiring" : "/recruitment";
}

export const DEMO_READ_ONLY_CODE = "DEMO_READ_ONLY";

export const DEMO_READ_ONLY_MESSAGE =
  "The public demo is read-only, so this action is turned off.";

export const DEMO_SANDBOX_NOTICE =
  "Public sandbox. Other visitors can see what you type.";

/**
 * The only API writes a public demo visitor can make. Matched against the raw
 * path, case-sensitive, and path segments allow no dots or percent escapes, so
 * an encoded path can never pass as one of these. Add a route here only if it
 * cannot change the shared demo beyond a chat turn, feedback or a ticket.
 */
const DEMO_WRITE_ALLOW_LIST = [
  /^\/api\/widget(?:\/[A-Za-z0-9_-]+)+$/,
  /^\/api\/chat$/,
  /^\/api\/chat\/stream$/,
  /^\/api\/messages\/[A-Za-z0-9_-]+\/feedback$/,
  /^\/api\/contact$/,
  /^\/api\/demo\/seed$/,
  /^\/api\/webhooks\/clerk$/,
];

/** Loose on purpose: anything Next might route to /api counts as an API path. */
function looksLikeApiPath(pathname: string) {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape stays as it came in.
  }
  return /^[/\\]+api(?:[/\\]|$)/i.test(path);
}

/** Fails closed: an API write not on the allow-list is blocked, including new routes. */
export function isDemoWriteBlocked(method: string, pathname: string) {
  if (!isPublicDemoMode() || method === "GET") return false;
  if (!looksLikeApiPath(pathname)) return false;
  return !DEMO_WRITE_ALLOW_LIST.some((allowed) => allowed.test(pathname));
}
