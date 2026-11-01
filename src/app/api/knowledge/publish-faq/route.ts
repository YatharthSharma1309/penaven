import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/json";
import { withAdminMembership } from "@/lib/auth/api";
import { DocumentInputError, ingestTextDocument } from "@/lib/documents/process";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  return withAdminMembership(async ({ organization }) => {
    if (
      await checkRateLimit(`publish-faq:${organization.id}`, 10, 60 * 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Publish rate limit exceeded. Try again later." },
        { status: 429 },
      );
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 },
      );
    }

    if (content.length < 40) {
      return NextResponse.json(
        { error: "FAQ content must be at least 40 characters." },
        { status: 400 },
      );
    }

    try {
      const document = await ingestTextDocument(organization.id, {
        title,
        content,
      });
      return NextResponse.json({ document });
    } catch (error) {
      if (error instanceof DocumentInputError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      console.error(error);
      return NextResponse.json({ error: "Failed to publish FAQ" }, { status: 500 });
    }
  });
}
