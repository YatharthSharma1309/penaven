import { db } from "@/lib/db";
import type { Organization } from "@/generated/prisma/client";
import { WidgetAuthError } from "@/lib/auth/widget-errors";
import { parseAgentSettings, type AgentSettings } from "@/lib/settings";

export { WidgetAuthError } from "@/lib/auth/widget-errors";

function getAllowedOrigins(settings: AgentSettings & Record<string, unknown>) {
  const widget = settings.widget as { allowedOrigins?: string[] } | undefined;
  return widget?.allowedOrigins ?? [];
}

function getAppOrigin() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    return new URL(appUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function normalizeOrigin(value: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function hostnameMatchesAllowed(hostname: string, allowed: string): boolean {
  const trimmed = allowed.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("*.")) {
    const baseDomain = trimmed.slice(2).toLowerCase();
    const host = hostname.toLowerCase();
    return host === baseDomain || host.endsWith(`.${baseDomain}`);
  }

  if (trimmed.includes("://")) {
    const allowedHost = hostnameFromOrigin(trimmed);
    return allowedHost !== null && hostname.toLowerCase() === allowedHost.toLowerCase();
  }

  return hostname.toLowerCase() === trimmed.toLowerCase();
}

export function isOriginPermitted(
  host: string,
  allowedOrigins: string[],
  appOrigin: string,
) {
  const hostOrigin = normalizeOrigin(host);
  if (!hostOrigin) return false;

  const normalizedAppOrigin = normalizeOrigin(appOrigin);
  if (normalizedAppOrigin && hostOrigin === normalizedAppOrigin) {
    return true;
  }

  const hostname = hostnameFromOrigin(hostOrigin);
  if (!hostname) return false;

  return allowedOrigins.some((allowed) => hostnameMatchesAllowed(hostname, allowed));
}

function resolveRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin") ?? "";
  if (origin) return origin;

  const referer = request.headers.get("referer") ?? "";
  if (!referer) return "";

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

export async function resolveWidgetOrganization(
  widgetKey: string | null | undefined,
  request?: Request,
): Promise<Organization> {
  const key = widgetKey?.trim();
  if (!key) {
    throw new WidgetAuthError("Widget key is required.");
  }

  if (key.includes("\0")) {
    throw new WidgetAuthError("Invalid or disabled widget key.");
  }

  const organization = await db.organization.findFirst({
    where: { widgetPublicKey: key, widgetEnabled: true },
  });

  if (!organization) {
    throw new WidgetAuthError("Invalid or disabled widget key.");
  }

  if (request) {
    const settings = parseAgentSettings(organization.settings) as AgentSettings &
      Record<string, unknown>;
    const allowedOrigins = getAllowedOrigins(settings);
    const host = resolveRequestOrigin(request);

    if (!host) {
      throw new WidgetAuthError("Origin header is required.");
    }

    const appOrigin = getAppOrigin();
    if (!isOriginPermitted(host, allowedOrigins, appOrigin)) {
      throw new WidgetAuthError("Origin is not allowed for this widget.");
    }
  }

  return organization;
}

export function getWidgetKeyFromRequest(request: Request) {
  const headerKey = request.headers.get("x-widget-key");
  if (headerKey) return headerKey;

  try {
    const url = new URL(request.url);
    return url.searchParams.get("key");
  } catch {
    return null;
  }
}

export function widgetAuthErrorResponse(error: unknown) {
  if (error instanceof WidgetAuthError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  return null;
}
