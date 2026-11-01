import { NextResponse } from "next/server";
import { MULTIPART_OVERHEAD_BYTES, parseFormData } from "@/lib/api/form-data";
import { withAdminMembership } from "@/lib/auth/api";
import { isAllowedUpload, MAX_UPLOAD_BYTES } from "@/lib/documents/constants";
import { DocumentInputError, ingestUploadedFile } from "@/lib/documents/process";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const FILE_TOO_LARGE = "File must be 10 MB or smaller.";

function uploadErrorResponse(error: unknown) {
  if (error instanceof DocumentInputError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: "Failed to process document" },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  return withAdminMembership(async ({ organization }) => {
    if (
      await checkRateLimit(`upload:${organization.id}`, 10, 60 * 60 * 1000)
    ) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Try again later." },
        { status: 429 },
      );
    }

    const form = await parseFormData(
      request,
      MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES,
      FILE_TOO_LARGE,
    );
    if ("error" in form) return form.error;

    const file = form.data.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.name.includes("\0")) {
      return NextResponse.json(
        { error: "File name contains invalid characters." },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: FILE_TOO_LARGE }, { status: 413 });
    }

    if (!isAllowedUpload(file)) {
      return NextResponse.json(
        { error: "Only PDF, DOCX, TXT, and Markdown files are supported." },
        { status: 400 },
      );
    }

    try {
      const document = await ingestUploadedFile(organization.id, file);
      return NextResponse.json({ document });
    } catch (error) {
      return uploadErrorResponse(error);
    }
  });
}
