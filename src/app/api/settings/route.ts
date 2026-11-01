import { NextResponse } from "next/server";
import { withAdminMembership } from "@/lib/auth/api";
import { parseJsonBody } from "@/lib/api/json";
import {
  getAgentSettings,
  parseAgentSettings,
  updateAgentSettings,
} from "@/lib/settings";
import { parseAgentSettingsPatch } from "@/lib/settings-input";

export async function GET() {
  return withAdminMembership(async ({ organization }) => {
    const settings = await getAgentSettings(organization.id);
    return NextResponse.json({ settings });
  });
}

export async function PATCH(request: Request) {
  return withAdminMembership(async ({ organization }) => {
    const parsed = await parseJsonBody<Record<string, unknown>>(request);
    if ("error" in parsed) return parsed.error;

    const input = parseAgentSettingsPatch(parsed.data);
    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }

    const { allowedOrigins, ...fields } = input.patch;
    const current = await getAgentSettings(organization.id);

    const next = parseAgentSettings({
      ...current,
      ...fields,
      widget: {
        ...current.widget,
        ...(allowedOrigins ? { allowedOrigins } : {}),
      },
    });

    await updateAgentSettings(organization.id, next);
    return NextResponse.json({ settings: next });
  });
}
