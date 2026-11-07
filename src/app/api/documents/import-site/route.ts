import { NextResponse } from "next/server";
import { parseJsonBodyLimited, readTextField } from "@/lib/api/json";
import { withAdminMembership } from "@/lib/auth/api";
import { importWebsite } from "@/lib/site-import/import";
import { ImportFetchError } from "@/lib/site-import/safe-fetch";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Imports up to 25 pages of a public website into Knowledge. */
export async function POST(request: Request) {
  return withAdminMembership(async ({ organization }) => {
    if (await checkRateLimit(`site-import:${organization.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Five website imports an hour is the limit. Try again later." },
        { status: 429 },
      );
    }

    const parsed = await parseJsonBodyLimited(request, 4 * 1024);
    if ("error" in parsed) return parsed.error;
    const address = readTextField(parsed.data.url);
    if (!address) {
      return NextResponse.json(
        { error: "Enter a website address such as https://example.com." },
        { status: 400 },
      );
    }

    try {
      const summary = await importWebsite(organization.id, address);
      if (summary.imported.length === 0) {
        return NextResponse.json(
          {
            error:
              summary.skipped[0]?.reason ??
              "No pages with enough text were found. Check the address, or upload the pages as files.",
            summary,
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ summary });
    } catch (error) {
      if (error instanceof ImportFetchError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  });
}
