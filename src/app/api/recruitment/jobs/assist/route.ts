import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { checkRateLimit } from "@/lib/rate-limit";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { generateJobCriteria } from "@/lib/recruitment/services/job-assist";
import { jobAssistSchema } from "@/lib/recruitment/validators";

export async function POST(request: Request) {
  return withRecruitmentOrg(async ({ organization }) => {
    if (
      await checkRateLimit(`recruitment-assist:${organization.id}`, 10, 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429 },
      );
    }

    const body = await parseJsonBody(request);
    if ("error" in body) return body.error;

    const parsed = jobAssistSchema.safeParse(body.data);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid assist payload." },
        { status: 400 },
      );
    }

    const suggestion = await generateJobCriteria(parsed.data);
    return NextResponse.json({ suggestion });
  });
}
