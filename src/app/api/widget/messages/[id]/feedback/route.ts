import { NextResponse } from "next/server";
import {
  getWidgetKeyFromRequest,
  resolveWidgetOrganization,
  widgetAuthErrorResponse,
} from "@/lib/auth/widget";
import { assertWidgetVisitor } from "@/lib/auth/widget-visitor";
import { parseJsonBody } from "@/lib/api/json";
import { prismaErrorResponse } from "@/lib/api/prisma-errors";
import { db } from "@/lib/db";
import { checkRateLimit, clientIpBucket } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const widgetKey = getWidgetKeyFromRequest(request);
    const organization = await resolveWidgetOrganization(widgetKey, request);

    const ip = clientIpBucket(request);
    if (
      await checkRateLimit(`widget-feedback:${organization.id}:${ip}`, 60, 60_000)
    ) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { id } = await context.params;

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const visitorId = assertWidgetVisitor(
      organization.id,
      body.visitorId,
      body.visitorToken,
    );

    if (typeof body.helpful !== "boolean") {
      return NextResponse.json(
        { error: "helpful must be a boolean" },
        { status: 400 },
      );
    }

    const message = await db.message.findFirst({
      where: {
        id,
        role: "ASSISTANT",
        conversation: {
          organizationId: organization.id,
          visitorId,
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updated = await db.message.update({
      where: { id },
      data: { helpful: body.helpful },
    });

    return NextResponse.json({ message: updated });
  } catch (error) {
    const widgetResponse = widgetAuthErrorResponse(error);
    if (widgetResponse) return widgetResponse;

    const databaseResponse = prismaErrorResponse(error);
    if (databaseResponse) return databaseResponse;

    console.error(error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }
}
