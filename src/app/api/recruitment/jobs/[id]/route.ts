import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { recordRecruitmentAuditEvent } from "@/lib/recruitment/services/audit";
import { deleteJob, getJobDetail, updateJob } from "@/lib/recruitment/services/jobs";
import { createJobSchema } from "@/lib/recruitment/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return withRecruitmentOrg(async ({ organization }) => {
    const job = await getJobDetail(organization.id, id);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json({ job });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

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

    const job = await updateJob(organization.id, id, parsed.data);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: "job.update",
      entityType: "job",
      entityId: id,
      actorId: user.id,
    });

    return NextResponse.json({ job });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return withRecruitmentOrg(async ({ organization, user }) => {
    const deleted = await deleteJob(organization.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: "job.delete",
      entityType: "job",
      entityId: id,
      actorId: user.id,
    });

    return NextResponse.json({ ok: true });
  });
}
