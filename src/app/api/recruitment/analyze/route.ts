export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { runCostUsd } from "@/lib/billing/cost";
import { resumeScreenCapMessage } from "@/lib/billing/plans";
import { resumeScreensCapped } from "@/lib/billing/usage";
import { checkRateLimit } from "@/lib/rate-limit";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import {
  recordRecruitmentAuditEvent,
  RESUME_SCREEN_AUDIT_ACTION,
} from "@/lib/recruitment/services/audit";
import { analyzeCandidate } from "@/lib/recruitment/services/analyze";
import { getCandidateDetail } from "@/lib/recruitment/services/candidates";
import { analyzeCandidateSchema } from "@/lib/recruitment/validators";

export async function POST(request: Request) {
  return withRecruitmentOrg(async ({ organization, user }) => {
    if (
      await checkRateLimit(`recruitment-analyze:${organization.id}`, 10, 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Analysis rate limit exceeded. Try again shortly." },
        { status: 429 },
      );
    }

    const body = await parseJsonBody(request);
    if ("error" in body) return body.error;

    const parsed = analyzeCandidateSchema.safeParse(body.data);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid analyze payload." },
        { status: 400 },
      );
    }

    if (await resumeScreensCapped(organization.id)) {
      return NextResponse.json(
        { error: resumeScreenCapMessage() },
        { status: 402 },
      );
    }

    const candidateId = parsed.data.candidateId;
    const candidate = await getCandidateDetail(organization.id, candidateId);
    const screened = await analyzeCandidate(organization.id, candidateId);
    const { analysis } = screened;

    await recordRecruitmentAuditEvent({
      organizationId: organization.id,
      action: RESUME_SCREEN_AUDIT_ACTION,
      entityType: "candidate",
      entityId: candidateId,
      actorId: user.id,
      metadata: {
        jobId: candidate?.jobId ?? null,
        analysisId: analysis.id,
        matchScore: analysis.matchScore,
        evidencePresent: screened.evidencePresent,
        inputTokens: screened.usage?.inputTokens ?? null,
        outputTokens: screened.usage?.outputTokens ?? null,
        costUsd: screened.usage ? runCostUsd(screened.usage) : null,
      },
    });

    return NextResponse.json({ analysis });
  });
}
