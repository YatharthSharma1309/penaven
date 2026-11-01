import { describe, expect, it } from "vitest";
import { parseFormData } from "./form-data";

const URL = "http://localhost/api/upload";
const BOUNDARY = "----penaven-test";

function multipartBody(closed = true) {
  const head = [
    `--${BOUNDARY}`,
    'Content-Disposition: form-data; name="file"; filename="a.txt"',
    "Content-Type: text/plain",
    "",
    "hello",
  ].join("\r\n");
  return closed ? `${head}\r\n--${BOUNDARY}--\r\n` : head;
}

async function statusOf(request: Request, maxBytes = 1024) {
  const result = await parseFormData(request, maxBytes, "Too large.");
  return "error" in result ? result.error.status : 200;
}

describe("parseFormData", () => {
  it("reads a complete multipart body", async () => {
    const form = new FormData();
    form.set("jobId", "job_1");
    form.set("file", new File(["hello"], "a.txt", { type: "text/plain" }));

    const result = await parseFormData(
      new Request(URL, { method: "POST", body: form }),
      1024,
      "Too large.",
    );

    if (!("data" in result)) throw new Error("expected form data");
    expect(result.data.get("jobId")).toBe("job_1");
    expect(result.data.get("file")).toBeInstanceOf(File);
  });

  it.each([
    ["no body", new Request(URL, { method: "POST" })],
    [
      "a JSON body",
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    ],
    [
      "text/plain",
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      }),
    ],
    [
      "multipart with no boundary",
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: multipartBody(),
      }),
    ],
    [
      "truncated multipart",
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${BOUNDARY}` },
        body: multipartBody(false),
      }),
    ],
  ])("returns 400 for %s", async (_label, request) => {
    expect(await statusOf(request)).toBe(400);
  });

  it("returns 413 from a declared content-length without reading the body", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "Content-Length": "999999" },
      body: "x",
    });
    const result = await parseFormData(request, 1024, "Too large.");
    if (!("error" in result)) throw new Error("expected an error");
    expect(result.error.status).toBe(413);
    expect((await result.error.json()).error).toBe("Too large.");
  });

  it("returns 413 when an undeclared body runs past the limit", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1000));
        controller.enqueue(new Uint8Array(1000));
        controller.close();
      },
    });
    const request = new Request(URL, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await statusOf(request)).toBe(413);
  });
});
