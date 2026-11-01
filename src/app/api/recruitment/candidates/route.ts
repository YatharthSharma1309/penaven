import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { recordRecruitmentAuditEvent } from "@/lib/recruitment/services/audit";
import { createCandidateFromText } from "@/lib/recruitment/services/candidates";
import { createCandidateTextSchema } from "@/lib/recruitment/validators";

export async function POST(request: Request) {
  return withRecruitmentOrg(async ({ organization, user }) => {
    const body = await parseJsonBody(request);
    if ("error" in body) return body.error;

    const parsed = createCandidateTextSchema.safeParse(body.data);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid candidate payload." },
        { status: 400 },
      );
    }

    const candidate = await createCandidateFromText({
      organizationId: organization.id,
      ...parsed.data,
      parseStatus: "manual",
    });

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: "candidate.create_manual",
      entityType: "candidate",
      entityId: candidate.id,
      actorId: user.id,
      metadata: { jobId: candidate.jobId },
    });

    return NextResponse.json({ candidate }, { status: 201 });
  });
}
