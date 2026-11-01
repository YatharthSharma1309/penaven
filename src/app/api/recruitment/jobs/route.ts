import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { roleCapMessage } from "@/lib/billing/plans";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { recordRecruitmentAuditEvent } from "@/lib/recruitment/services/audit";
import { createJobWithinCap, listJobs } from "@/lib/recruitment/services/jobs";
import { createJobSchema } from "@/lib/recruitment/validators";

export async function GET() {
  return withRecruitmentOrg(async ({ organization }) => {
    const jobs = await listJobs(organization.id);
    return NextResponse.json({ jobs });
  });
}

export async function POST(request: Request) {
  return withRecruitmentOrg(async ({ organization, user }) => {
    const body = await parseJsonBody(request);
    if ("error" in body) return body.error;

    const parsed = createJobSchema.safeParse(body.data);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid job payload." },
        { status: 400 },
      );
    }

    const job = await createJobWithinCap(organization.id, parsed.data);
    if (!job) {
      return NextResponse.json({ error: roleCapMessage() }, { status: 402 });
    }

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: "job.create",
      entityType: "job",
      entityId: job.id,
      actorId: user.id,
    });

    return NextResponse.json({ job }, { status: 201 });
  });
}
