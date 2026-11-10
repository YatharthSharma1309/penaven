import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import {
  AUTO_REJECT_MODES,
  DEFAULT_AUTO_REJECT_MODE,
  isAutoRejectMode,
} from "@/lib/recruitment/auto-reject";
import { setAutoReject } from "@/lib/recruitment/services/auto-reject";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Turns auto-reject on or off for one role. Admins only. When turning on, an
 * optional `mode` picks the trigger; it defaults to "contradicts".
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  return withRecruitmentOrg(async ({ organization, user, role }) => {
    if (role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only an admin can change auto-reject for a role." },
        { status: 403 },
      );
    }

    const body = await parseJsonBody(request);
    if ("error" in body) return body.error;

    const { enabled, mode } = (body.data ?? {}) as { enabled?: unknown; mode?: unknown };
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Send enabled as true or false." }, { status: 400 });
    }
    if (mode !== undefined && !isAutoRejectMode(mode)) {
      return NextResponse.json(
        { error: `Send mode as one of: ${AUTO_REJECT_MODES.join(", ")}.` },
        { status: 400 },
      );
    }
    const nextMode = enabled ? (mode ?? DEFAULT_AUTO_REJECT_MODE) : undefined;

    const updated = await setAutoReject({
      organizationId: organization.id,
      jobId: id,
      enabled,
      mode: nextMode,
      actorId: user.id,
    });
    if (!updated) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(
      nextMode ? { autoRejectEnabled: enabled, autoRejectMode: nextMode } : { autoRejectEnabled: enabled },
    );
  });
}
