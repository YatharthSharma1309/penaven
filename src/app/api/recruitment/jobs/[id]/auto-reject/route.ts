import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { setAutoReject } from "@/lib/recruitment/services/auto-reject";

type RouteContext = { params: Promise<{ id: string }> };

/** Turns auto-reject on or off for one role. Admins only. */
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

    const enabled = (body.data as { enabled?: unknown } | null)?.enabled;
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Send enabled as true or false." }, { status: 400 });
    }

    const updated = await setAutoReject({
      organizationId: organization.id,
      jobId: id,
      enabled,
      actorId: user.id,
    });
    if (!updated) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ autoRejectEnabled: enabled });
  });
}
