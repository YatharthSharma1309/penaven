export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MULTIPART_OVERHEAD_BYTES, parseFormData } from "@/lib/api/form-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { appConfig } from "@/lib/recruitment/config";
import { RecruitmentError } from "@/lib/recruitment/errors";
import { recordRecruitmentAuditEvent } from "@/lib/recruitment/services/audit";
import { createCandidateFromUpload } from "@/lib/recruitment/services/candidates";
import { resolveUploadMime } from "@/lib/recruitment/validators";

export async function POST(request: Request) {
  return withRecruitmentOrg(async ({ organization, user }) => {
    if (
      await checkRateLimit(`recruitment-upload:${organization.id}`, 60, 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Try again shortly." },
        { status: 429 },
      );
    }

    const form = await parseFormData(
      request,
      appConfig.maxUploadBytes + MULTIPART_OVERHEAD_BYTES,
      `File exceeds ${Math.round(appConfig.maxUploadBytes / (1024 * 1024))}MB limit.`,
    );
    if ("error" in form) return form.error;

    const jobId = form.data.get("jobId");
    const file = form.data.get("file");

    if (typeof jobId !== "string" || !jobId.trim()) {
      throw new RecruitmentError("jobId is required.", 400, "MISSING_JOB_ID");
    }

    if (jobId.includes("\0")) {
      throw new RecruitmentError("Job not found.", 404, "JOB_NOT_FOUND");
    }

    if (!(file instanceof File)) {
      throw new RecruitmentError("Resume file is required.", 400, "MISSING_FILE");
    }

    if (file.name.includes("\0")) {
      throw new RecruitmentError(
        "File name contains invalid characters.",
        400,
        "INVALID_FILE_NAME",
      );
    }

    const mimeType = resolveUploadMime(file.type || "", file.name);
    if (!mimeType) {
      throw new RecruitmentError(
        "Only PDF and DOCX files are supported.",
        400,
        "INVALID_FILE_TYPE",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const candidate = await createCandidateFromUpload({
      organizationId: organization.id,
      jobId: jobId.trim(),
      fileName: file.name,
      mimeType,
      buffer,
    });

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: "candidate.upload",
      entityType: "candidate",
      entityId: candidate.id,
      actorId: user.id,
      metadata: {
        jobId: candidate.jobId,
        mimeType,
        parseStatus: candidate.parseStatus,
      },
    });

    return NextResponse.json({ candidate }, { status: 201 });
  });
}
