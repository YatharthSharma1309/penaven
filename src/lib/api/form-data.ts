import { NextResponse } from "next/server";
import { readBodyLimited } from "@/lib/api/json";

/** Room for multipart boundaries, part headers, and small text fields. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const invalidUpload = () => ({
  error: NextResponse.json(
    { error: "Send the upload as multipart/form-data with a file." },
    { status: 400 },
  ),
});

/**
 * Reads a form body of at most `maxBytes`. Anything that is not a complete
 * form, such as JSON, no body, or a cut-off multipart body, is a 400.
 */
export async function parseFormData(
  request: Request,
  maxBytes: number,
  tooLargeMessage: string,
): Promise<{ data: FormData } | { error: NextResponse }> {
  const body = await readBodyLimited(request, maxBytes);
  if (body === "too-large") {
    return { error: NextResponse.json({ error: tooLargeMessage }, { status: 413 }) };
  }
  if (body === "unreadable") return invalidUpload();

  try {
    const form = new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    });
    return { data: await form.formData() };
  } catch {
    return invalidUpload();
  }
}
