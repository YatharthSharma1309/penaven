import { NextResponse } from "next/server";
import { parseJsonBody, readTextField } from "@/lib/api/json";
import {
  getWidgetKeyFromRequest,
  resolveWidgetOrganization,
  widgetAuthErrorResponse,
} from "@/lib/auth/widget";
import {
  createVisitorToken,
  isValidVisitorId,
} from "@/lib/auth/widget-visitor";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const widgetKey = getWidgetKeyFromRequest(request);
    const organization = await resolveWidgetOrganization(widgetKey, request);

    const ip = getClientIp(request);
    if (
      (await checkRateLimit(`widget-session:${organization.id}:${ip}`, 30, 60_000)) ||
      (await checkRateLimit(`widget-session:${organization.id}`, 200, 60_000))
    ) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    let visitorId = readTextField(parsed.data.visitorId);

    if (visitorId === null) {
      return NextResponse.json({ error: "Invalid visitorId format" }, { status: 400 });
    }

    if (!visitorId) {
      visitorId = randomUUID();
    } else if (!isValidVisitorId(visitorId)) {
      return NextResponse.json({ error: "Invalid visitorId format" }, { status: 400 });
    }

    const visitorToken = createVisitorToken(organization.id, visitorId);

    return NextResponse.json({ visitorId, visitorToken });
  } catch (error) {
    const widgetResponse = widgetAuthErrorResponse(error);
    if (widgetResponse) return widgetResponse;

    console.error(error);
    return NextResponse.json(
      { error: "Failed to create visitor session" },
      { status: 500 },
    );
  }
}
