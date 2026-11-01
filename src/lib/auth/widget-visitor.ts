import { createHmac, timingSafeEqual } from "crypto";
import { WidgetAuthError } from "@/lib/auth/widget-errors";
import { isPublicDemoMode } from "@/lib/env/public-demo";

const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A SHA-256 HMAC in hex. Buffer.from stops at the first bad character, so check first. */
const VISITOR_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function getVisitorSigningSecret() {
  const secret = process.env.WIDGET_VISITOR_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production" && !isPublicDemoMode()) {
    throw new Error("WIDGET_VISITOR_SECRET is required in production.");
  }

  return process.env.CLERK_SECRET_KEY || "dev-widget-visitor-secret";
}

export function isValidVisitorId(visitorId: string) {
  return VISITOR_ID_PATTERN.test(visitorId);
}

export function createVisitorToken(organizationId: string, visitorId: string) {
  return createHmac("sha256", getVisitorSigningSecret())
    .update(`${organizationId}:${visitorId}`)
    .digest("hex");
}

export function verifyVisitorToken(
  organizationId: string,
  visitorId: string,
  token: string,
) {
  if (!visitorId || !VISITOR_TOKEN_PATTERN.test(token)) return false;

  const expected = createVisitorToken(organizationId, visitorId);

  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const tokenBuffer = Buffer.from(token, "hex");
    return (
      expectedBuffer.length === tokenBuffer.length &&
      timingSafeEqual(expectedBuffer, tokenBuffer)
    );
  } catch {
    return false;
  }
}

export function assertWidgetVisitor(
  organizationId: string,
  visitorId: unknown,
  visitorToken: unknown,
) {
  const id = typeof visitorId === "string" ? visitorId.trim() : "";
  if (!id) {
    throw new WidgetAuthError("visitorId is required.");
  }

  if (!isValidVisitorId(id)) {
    throw new WidgetAuthError("Invalid visitorId format.");
  }

  const token = typeof visitorToken === "string" ? visitorToken.trim() : "";
  if (!token || !verifyVisitorToken(organizationId, id, token)) {
    throw new WidgetAuthError("Invalid visitor session.");
  }

  return id;
}
