import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withOrgMembership } from "@/lib/auth/api";
import { MAX_FAQ_TOPIC_CHARS } from "@/lib/documents/constants";
import { draftFaqFromGap } from "@/lib/knowledge/draft-faq";
import { RecruitmentError } from "@/lib/recruitment/errors";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  return withOrgMembership(async ({ organization }) => {
    if (
      await checkRateLimit(`draft-faq:${organization.id}`, 20, 60 * 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Draft rate limit exceeded. Try again later." },
        { status: 429 },
      );
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (topic.length < 3) {
      return NextResponse.json(
        { error: "Provide a knowledge-gap topic to draft." },
        { status: 400 },
      );
    }

    if (topic.length > MAX_FAQ_TOPIC_CHARS) {
      return NextResponse.json(
        { error: `Topic must be ${MAX_FAQ_TOPIC_CHARS} characters or fewer.` },
        { status: 400 },
      );
    }

    try {
      const draft = await draftFaqFromGap(organization.id, topic);
      return NextResponse.json({ draft });
    } catch (error) {
      if (error instanceof RecruitmentError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      console.error(error);
      return NextResponse.json({ error: "Failed to draft FAQ" }, { status: 500 });
    }
  });
}
