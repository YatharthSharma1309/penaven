import { NextResponse } from "next/server";
import { withAdminMembership } from "@/lib/auth/api";
import { parseJsonBody } from "@/lib/api/json";
import { generateWidgetPublicKey } from "@/lib/auth/demo";
import { db } from "@/lib/db";
import { getAgentSettings, parseAgentSettings, updateAgentSettings } from "@/lib/settings";
import { parseAllowedOrigins } from "@/lib/settings-input";

export async function POST() {
  return withAdminMembership(async ({ organization }) => {
    const widgetPublicKey = generateWidgetPublicKey();

    const updated = await db.organization.update({
      where: { id: organization.id },
      data: { widgetPublicKey },
    });

    return NextResponse.json({
      widgetPublicKey: updated.widgetPublicKey,
    });
  });
}

export async function PATCH(request: Request) {
  return withAdminMembership(async ({ organization }) => {
    const parsed = await parseJsonBody<Record<string, unknown>>(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    if (body.widgetEnabled !== undefined && typeof body.widgetEnabled !== "boolean") {
      return NextResponse.json(
        { error: "widgetEnabled must be true or false." },
        { status: 400 },
      );
    }
    const widgetEnabled = body.widgetEnabled ?? organization.widgetEnabled;

    const origins =
      body.allowedOrigins === undefined ? null : parseAllowedOrigins(body.allowedOrigins);
    if (origins && "error" in origins) {
      return NextResponse.json({ error: origins.error }, { status: 400 });
    }

    const current = await getAgentSettings(organization.id);
    const allowedOrigins = origins?.origins ?? current.widget?.allowedOrigins ?? [];

    await db.organization.update({
      where: { id: organization.id },
      data: { widgetEnabled },
    });

    await updateAgentSettings(organization.id, {
      ...current,
      widget: { allowedOrigins },
    });

    return NextResponse.json({
      widgetEnabled,
      allowedOrigins,
    });
  });
}

export async function GET() {
  return withAdminMembership(async ({ organization }) => {
    const settings = parseAgentSettings(organization.settings);
    return NextResponse.json({
      widgetPublicKey: organization.widgetPublicKey,
      widgetEnabled: organization.widgetEnabled,
      allowedOrigins: settings.widget?.allowedOrigins ?? [],
      slug: organization.slug,
    });
  });
}
