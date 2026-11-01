import { describe, expect, it } from "vitest";
import { parseJsonBody, parseJsonBodyLimited, readTextField } from "./json";

function jsonRequest(body: string | null) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === null ? {} : { body }),
  });
}

const parsers = [
  ["parseJsonBody", (request: Request) => parseJsonBody(request)],
  ["parseJsonBodyLimited", (request: Request) => parseJsonBodyLimited(request, 1024)],
] as const;

describe("parseJsonBody", () => {
  it("returns parsed JSON on valid body", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseJsonBody<{ message: string }>(request);

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.message).toBe("hello");
    }
  });

  it("returns 400 error on invalid JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "{not-json",
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseJsonBody(request);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.error).toBe("Invalid JSON body");
    }
  });
});

describe.each(parsers)("%s shared rules", (_name, parse) => {
  it("accepts an empty object", async () => {
    expect(await parse(jsonRequest("{}"))).toEqual({ data: {} });
  });

  it.each(["null", "[]", "[1,2]", "5", "0", "true", '"text"'])(
    "rejects the non-object body %s with 400",
    async (body) => {
      const result = await parse(jsonRequest(body));
      if (!("error" in result)) throw new Error("expected an error");
      expect(result.error.status).toBe(400);
      expect((await result.error.json()).error).toMatch(/JSON object/);
    },
  );

  it.each([
    ["empty text", ""],
    ["no body", null],
    ["malformed", "{bad"],
  ])("rejects %s with 400", async (_label, body) => {
    const result = await parse(jsonRequest(body));
    if (!("error" in result)) throw new Error("expected an error");
    expect(result.error.status).toBe(400);
  });

  it.each([
    ["a top-level string", '{"a":"x\\u0000y"}'],
    ["a nested string", '{"a":{"b":["ok",{"c":"\\u0000"}]}}'],
    ["a key", '{"a\\u0000b":1}'],
    ["a nested key", '{"a":{"\\u0000":1}}'],
  ])("rejects a NUL in %s with 400", async (_label, body) => {
    const result = await parse(jsonRequest(body));
    if (!("error" in result)) throw new Error("expected an error");
    expect(result.error.status).toBe(400);
    expect((await result.error.json()).error).toMatch(/invalid characters/);
  });

  it("keeps a backslash that only looks like a NUL escape", async () => {
    const result = await parse(jsonRequest('{"a":"\\\\u0000"}'));
    expect(result).toEqual({ data: { a: "\\u0000" } });
  });

  it("replaces a lone surrogate, which a jsonb column would reject", async () => {
    const result = await parse(jsonRequest('{"a":"cut \\ud83d","b":["\\ude00"]}'));
    expect(result).toEqual({ data: { a: "cut �", b: ["�"] } });
  });

  it("keeps a real emoji", async () => {
    const result = await parse(jsonRequest('{"a":"\\ud83d\\ude00"}'));
    expect(result).toEqual({ data: { a: "\u{1F600}" } });
  });

  it("does not throw on very deep nesting", async () => {
    const deep = `{"a":${"[".repeat(200)}${"]".repeat(200)}}`;
    expect("data" in (await parse(jsonRequest(deep)))).toBe(true);
  });
});

describe("parseJsonBodyLimited", () => {
  it("returns 413 past the limit", async () => {
    const result = await parseJsonBodyLimited(
      jsonRequest(JSON.stringify({ a: "x".repeat(100) })),
      50,
    );
    if (!("error" in result)) throw new Error("expected an error");
    expect(result.error.status).toBe(413);
  });
});

describe("readTextField", () => {
  it("treats missing and null as empty", () => {
    expect(readTextField(undefined)).toBe("");
    expect(readTextField(null)).toBe("");
  });

  it("trims strings", () => {
    expect(readTextField("  hi ")).toBe("hi");
  });

  it.each([[0], [5], [false], [true], [{}], [[]], [{ toString: 1 }]])(
    "returns null for %j",
    (value) => {
      expect(readTextField(value)).toBeNull();
    },
  );
});
