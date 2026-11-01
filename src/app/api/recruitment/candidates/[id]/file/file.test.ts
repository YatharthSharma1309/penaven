import { beforeEach, describe, expect, it, vi } from "vitest";

/** Drives the real download handler with an in-memory candidate row. */

const store = vi.hoisted(() => ({ fileName: "" }));

vi.mock("@/lib/env/public-demo", () => ({ isPublicDemoMode: () => false }));

vi.mock("@/lib/auth", () => ({
  withOrgMembership: (handler: (context: unknown) => Promise<unknown>) =>
    handler({ organization: { id: "org_1" }, user: { id: "user_1" } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    candidate: {
      findFirst: vi.fn(async () => ({
        fileBytes: new Uint8Array([37, 80, 68, 70]),
        fileName: store.fileName,
        mimeType: "application/pdf",
      })),
    },
  },
}));

import { GET } from "@/app/api/recruitment/candidates/[id]/file/route";

async function download(fileName: string) {
  store.fileName = fileName;
  return GET(new Request("http://localhost/api/recruitment/candidates/c1/file"), {
    params: Promise.resolve({ id: "c1" }),
  });
}

function parts(disposition: string | null) {
  const match = disposition?.match(/^attachment; filename="([^"]*)"; filename\*=UTF-8''(\S+)$/);
  expect(match).not.toBeNull();
  return { fallback: match?.[1] ?? "", encoded: match?.[2] ?? "" };
}

describe("GET resume file", () => {
  beforeEach(() => {
    store.fileName = "";
  });

  it.each([
    ["简历.pdf", "__.pdf", "简历.pdf"],
    ["cv😀.pdf", "cv_.pdf", "cv😀.pdf"],
    ["René.pdf", "Rene.pdf", "René.pdf"],
    ["bad\u0007name.pdf", "badname.pdf", "badname.pdf"],
    ["line\r\nbreak.pdf", "linebreak.pdf", "linebreak.pdf"],
    ['quo"te\\d.pdf', "quo_te_d.pdf", 'quo"te\\d.pdf'],
    ["half\uD83D.pdf", "half.pdf", "half.pdf"],
    ["maya-chen.pdf", "maya-chen.pdf", "maya-chen.pdf"],
  ])("downloads %j", async (fileName, fallback, decoded) => {
    const response = await download(fileName);

    expect(response.status).toBe(200);
    const header = parts(response.headers.get("Content-Disposition"));
    expect(header.fallback).toBe(fallback);
    expect(decodeURIComponent(header.encoded)).toBe(decoded);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([37, 80, 68, 70]),
    );
  });

  it("keeps the fallback plain ASCII", async () => {
    const response = await download("Émile 简历 😀.pdf");

    const header = response.headers.get("Content-Disposition") ?? "";
    expect(header).toMatch(/^[\x20-\x7E]+$/);
  });

  it("percent encodes the characters RFC 8187 does not allow in filename*", async () => {
    const response = await download("it's (final)*.pdf");

    expect(parts(response.headers.get("Content-Disposition")).encoded).toBe(
      "it%27s%20%28final%29%2A.pdf",
    );
  });

  it("falls back to resume when no usable characters remain", async () => {
    const response = await download("\u0007\u0008");

    expect(parts(response.headers.get("Content-Disposition"))).toEqual({
      fallback: "resume",
      encoded: "resume",
    });
  });
});
