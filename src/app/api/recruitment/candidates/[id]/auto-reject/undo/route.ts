import { NextResponse } from "next/server";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { undoAutoReject } from "@/lib/recruitment/services/auto-reject";

type RouteContext = { params: Promise<{ id: string }> };

/** Puts an auto-rejected person back where they were. */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return withRecruitmentOrg(async ({ organization, user }) => {
    const candidate = await undoAutoReject({
      organizationId: organization.id,
      candidateId: id,
      actorId: user.id,
    });
    return NextResponse.json({ candidate });
  });
}
