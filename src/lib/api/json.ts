import { NextResponse } from "next/server";

export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}

/**
 * Reads a JSON body of at most `maxBytes`. The limit is enforced while the
 * stream is read, so a missing or false `content-length` cannot get past it.
 */
export async function parseJsonBodyLimited<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number,
): Promise<{ data: T } | { error: NextResponse }> {
  const tooLarge = () => ({
    error: NextResponse.json({ error: "Message is too large." }, { status: 413 }),
  });
  const invalid = () => ({
    error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
  });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  if (!request.body) return invalid();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        return tooLarge();
      }
      chunks.push(value);
    }
  } catch {
    return invalid();
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return invalid();
  }
}
