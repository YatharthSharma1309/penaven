import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real route handlers with bad input. Prisma is a fake and the org
 * session is stubbed, so no database, Clerk, or AI service is contacted.
 */

const store = vi.hoisted(() => ({
  ticket: null as Record<string, unknown> | null,
  message: null as Record<string, unknown> | null,
  member: null as Record<string, unknown> | null,
  settings: null as unknown,
  widgetEnabled: true,
}));

const chunkCreateMany = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));

vi.mock("@/lib/db", () => {
  const row = () => vi.fn(async () => null);
  return {
    db: {
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) =>
        run({ documentChunk: { createMany: chunkCreateMany } }),
      ),
      organization: {
        findFirst: vi.fn(async () => ({
          id: "org_1",
          widgetEnabled: true,
          settings: null,
        })),
        findUnique: vi.fn(async () => ({ settings: store.settings })),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.settings) store.settings = data.settings;
          return data;
        }),
      },
      organizationMember: { findFirst: vi.fn(async () => store.member) },
      ticket: {
        findFirst: vi.fn(async () => store.ticket),
        findMany: vi.fn(async () => []),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...store.ticket,
          ...data,
        })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "ticket_new",
          ...data,
        })),
      },
      ticketComment: {
        create: vi.fn(async ({ data }: { data: unknown }) => data),
      },
      conversation: { findFirst: row() },
      message: {
        findFirst: vi.fn(async () => store.message),
        update: vi.fn(async () => store.message),
      },
      document: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "doc_1",
          ...data,
        })),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "doc_1",
          ...data,
        })),
      },
      documentChunk: {
        deleteMany: vi.fn(async () => ({})),
      },
      job: { findFirst: row(), create: row(), count: vi.fn(async () => 0) },
      recruitmentJob: { findFirst: row() },
      candidate: { findFirst: row(), create: row() },
    },
  };
});

vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  authErrorResponse: () => null,
  getOrgMembershipContext: vi.fn(),
  requireOrgMembershipOrRedirect: vi.fn(),
  requireOrgMembership: vi.fn(async () => ({
    organization: { id: "org_1", widgetEnabled: true, settings: store.settings },
    user: { id: "user_1" },
    membership: { role: "ADMIN" },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => false),
  getClientIp: () => "203.0.113.1",
  getTrustedClientIp: () => "203.0.113.1",
}));

vi.mock("@/lib/billing/usage", () => ({
  assistantAnswersCapped: vi.fn(async () => false),
  resumeScreensCapped: vi.fn(async () => false),
  rolesCapped: vi.fn(async () => false),
}));

vi.mock("@/lib/chat/stream-handler", () => ({
  createChatStreamResponse: vi.fn(
    async () => new Response("stream", { status: 200 }),
  ),
}));

vi.mock("@/lib/recruitment/openrouter", () => ({
  createChatCompletion: vi.fn(async () => {
    throw new Error("no AI call may run in this test");
  }),
}));

vi.mock("@/lib/recruitment/services/candidates", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createCandidateFromUpload: vi.fn(async () => {
    throw new Error("the upload must stop before this");
  }),
}));

vi.mock("@/lib/rag/embed", () => ({
  createEmbeddings: vi.fn(async (texts: string[]) => texts.map(() => null)),
}));

import { POST as chatPOST } from "@/app/api/chat/route";
import { POST as chatStreamPOST } from "@/app/api/chat/stream/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { POST as demoSeedPOST } from "@/app/api/demo/seed/route";
import { POST as documentUploadPOST } from "@/app/api/documents/upload/route";
import { POST as draftFaqPOST, maxDuration as draftMaxDuration } from "@/app/api/knowledge/draft-faq/route";
import { POST as publishFaqPOST, maxDuration as publishMaxDuration } from "@/app/api/knowledge/publish-faq/route";
import { POST as feedbackPOST } from "@/app/api/messages/[id]/feedback/route";
import { POST as analyzePOST } from "@/app/api/recruitment/analyze/route";
import { PATCH as candidatePATCH } from "@/app/api/recruitment/candidates/[id]/route";
import { POST as candidatesPOST } from "@/app/api/recruitment/candidates/route";
import { PATCH as jobPATCH } from "@/app/api/recruitment/jobs/[id]/route";
import { POST as assistPOST } from "@/app/api/recruitment/jobs/assist/route";
import { POST as jobsPOST } from "@/app/api/recruitment/jobs/route";
import { POST as recruitmentUploadPOST } from "@/app/api/recruitment/upload/route";
import { PATCH as settingsPATCH } from "@/app/api/settings/route";
import { PATCH as widgetSettingsPATCH } from "@/app/api/settings/widget/route";
import { POST as commentsPOST } from "@/app/api/tickets/[id]/comments/route";
import { PATCH as ticketPATCH } from "@/app/api/tickets/[id]/route";
import { POST as ticketsPOST } from "@/app/api/tickets/route";
import { POST as widgetChatPOST } from "@/app/api/widget/chat/stream/route";
import { POST as widgetFeedbackPOST } from "@/app/api/widget/messages/[id]/feedback/route";
import { POST as widgetSessionPOST } from "@/app/api/widget/session/route";
import { POST as widgetTicketsPOST } from "@/app/api/widget/tickets/route";
import { createVisitorToken } from "@/lib/auth/widget-visitor";
import { db } from "@/lib/db";
import { createChatCompletion } from "@/lib/recruitment/openrouter";

const VISITOR_ID = "3f2b8c1a-1d2e-4c3b-9a8f-0123456789ab";
const WIDGET_HEADERS = {
  "X-Widget-Key": "pk_test",
  Origin: "http://localhost:3000",
};
const params = { params: Promise.resolve({ id: "row_1" }) };
const CUID = "cjld2cjxh0000qzrmn831i7rn";

function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const visitor = () => ({
  visitorId: VISITOR_ID,
  visitorToken: createVisitorToken("org_1", VISITOR_ID),
});

type Handler = (request: Request) => Promise<Response>;

const JSON_ROUTES: [string, Handler][] = [
  ["chat", chatPOST],
  ["chat/stream", chatStreamPOST],
  ["messages/[id]/feedback", (r) => feedbackPOST(r, params)],
  ["tickets", ticketsPOST],
  ["tickets/[id]", (r) => ticketPATCH(r, params)],
  ["tickets/[id]/comments", (r) => commentsPOST(r, params)],
  ["settings", settingsPATCH],
  ["settings/widget", widgetSettingsPATCH],
  ["knowledge/draft-faq", draftFaqPOST],
  ["knowledge/publish-faq", publishFaqPOST],
  ["recruitment/jobs", jobsPOST],
  ["recruitment/jobs/[id]", (r) => jobPATCH(r, params)],
  ["recruitment/jobs/assist", assistPOST],
  ["recruitment/candidates", candidatesPOST],
  ["recruitment/candidates/[id]", (r) => candidatePATCH(r, params)],
  ["recruitment/analyze", analyzePOST],
  ["widget/session", widgetSessionPOST],
  ["widget/chat/stream", widgetChatPOST],
  ["widget/messages/[id]/feedback", (r) => widgetFeedbackPOST(r, params)],
  ["widget/tickets", widgetTicketsPOST],
];

beforeEach(() => {
  store.ticket = { id: "row_1", organizationId: "org_1", status: "OPEN" };
  store.message = { id: "row_1" };
  store.member = null;
  store.settings = null;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("non-object, malformed, and empty JSON bodies", () => {
  const bodies = ["null", "[]", "5", '"text"', "true", "{bad", ""];
  const cases = JSON_ROUTES.flatMap(([name, handler]) =>
    bodies.map((body) => [name, JSON.stringify(body), body, handler] as const),
  );

  it.each(cases)("%s rejects %s with 400", async (_name, _label, body, handler) => {
    const response = await handler(jsonRequest("/api/test", body, WIDGET_HEADERS));
    expect(response.status).toBe(400);
  });

  it("contact gives a usable message", async () => {
    const response = await contactPOST(jsonRequest("/api/contact", "null"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/JSON object/);
  });
});

describe("NUL in a body", () => {
  it.each(JSON_ROUTES)("%s rejects it with 400", async (_name, handler) => {
    const response = await handler(
      jsonRequest("/api/test", '{"title":"a\\u0000b"}', WIDGET_HEADERS),
    );
    expect(response.status).toBe(400);
  });

  it("contact rejects it with 400", async () => {
    const response = await contactPOST(jsonRequest("/api/contact", '{"name":"\\u0000"}'));
    expect(response.status).toBe(400);
  });
});

describe("NUL in a widget key", () => {
  it("is a 401 and never reaches the database", async () => {
    const request = new Request("http://localhost:3000/api/widget/session?key=%00", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: "{}",
    });
    const response = await widgetSessionPOST(request);
    expect(response.status).toBe(401);
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });
});

describe("visitor fields", () => {
  it.each([[123], [true], [false], [0], [{}], [["a"]]])(
    "session rejects visitorId %j with 400",
    async (visitorId) => {
      const response = await widgetSessionPOST(
        jsonRequest("/api/widget/session", { visitorId }, WIDGET_HEADERS),
      );
      expect(response.status).toBe(400);
    },
  );

  it("session still issues a visitor id when none is sent", async () => {
    for (const body of [{}, { visitorId: null }, { visitorId: "" }]) {
      const response = await widgetSessionPOST(
        jsonRequest("/api/widget/session", body, WIDGET_HEADERS),
      );
      expect(response.status).toBe(200);
    }
  });

  const routes: [string, Handler][] = [
    ["widget/chat/stream", widgetChatPOST],
    ["widget/tickets", widgetTicketsPOST],
    ["widget/messages/[id]/feedback", (r) => widgetFeedbackPOST(r, params)],
  ];
  const badVisitors = [
    { visitorId: 123, visitorToken: "x" },
    { visitorId: {}, visitorToken: "x" },
    { visitorId: [VISITOR_ID], visitorToken: "x" },
    { visitorId: VISITOR_ID, visitorToken: 123 },
    { visitorId: VISITOR_ID, visitorToken: {} },
    { visitorId: VISITOR_ID, visitorToken: true },
  ];
  const cases = routes.flatMap(([name, handler]) =>
    badVisitors.map((body) => [name, body, handler] as const),
  );

  it.each(cases)("%s rejects %j with 401", async (_name, body, handler) => {
    const response = await handler(
      jsonRequest(
        "/api/test",
        { message: "hi", title: "t", helpful: true, ...body },
        WIDGET_HEADERS,
      ),
    );
    expect(response.status).toBe(401);
  });

  it.each(routes)("%s rejects a token with trailing junk", async (_name, handler) => {
    const { visitorId, visitorToken } = visitor();
    const response = await handler(
      jsonRequest(
        "/api/test",
        { message: "hi", title: "t", helpful: true, visitorId, visitorToken: `${visitorToken}zz` },
        WIDGET_HEADERS,
      ),
    );
    expect(response.status).toBe(401);
  });
});

describe("wrong types", () => {
  const messages: [unknown][] = [[5], [0], [{}], [["hi"]], [true], [false], [{ toString: 1 }]];

  it.each(messages)("admin chat rejects message %j", async (message) => {
    expect((await chatPOST(jsonRequest("/api/chat", { message }))).status).toBe(400);
  });

  it.each(messages)("admin chat stream rejects message %j", async (message) => {
    const response = await chatStreamPOST(jsonRequest("/api/chat/stream", { message }));
    expect(response.status).toBe(400);
  });

  it.each(messages)("widget chat rejects message %j", async (message) => {
    const response = await widgetChatPOST(
      jsonRequest("/api/widget/chat/stream", { message, ...visitor() }, WIDGET_HEADERS),
    );
    expect(response.status).toBe(400);
  });

  it.each([[5], [{}], [true]])("chat rejects conversationId %j", async (conversationId) => {
    const body = { message: "hi", conversationId };
    expect((await chatPOST(jsonRequest("/api/chat", body))).status).toBe(400);
    expect((await chatStreamPOST(jsonRequest("/api/chat", body))).status).toBe(400);
    const widget = await widgetChatPOST(
      jsonRequest("/api/test", { ...body, ...visitor() }, WIDGET_HEADERS),
    );
    expect(widget.status).toBe(400);
  });

  it("widget chat rejects a channel that cannot become a string", async () => {
    const response = await widgetChatPOST(
      jsonRequest(
        "/api/test",
        { message: "hi", channel: { toString: 1 }, ...visitor() },
        WIDGET_HEADERS,
      ),
    );
    expect(response.status).toBe(400);
  });

  it("widget chat still accepts a good message", async () => {
    const response = await widgetChatPOST(
      jsonRequest("/api/test", { message: "hi", ...visitor() }, WIDGET_HEADERS),
    );
    expect(response.status).toBe(200);
  });

  it.each([
    [{ title: {} }],
    [{ title: 5 }],
    [{ title: "t", requesterName: 5 }],
    [{ title: "t", description: {} }],
    [{ title: "t", requesterEmail: "not-an-email" }],
  ])("both ticket routes reject %j and store nothing", async (body) => {
    expect((await ticketsPOST(jsonRequest("/api/tickets", body))).status).toBe(400);
    const widget = await widgetTicketsPOST(
      jsonRequest("/api/widget/tickets", { ...body, ...visitor() }, WIDGET_HEADERS),
    );
    expect(widget.status).toBe(400);
    expect(db.ticket.create).not.toHaveBeenCalled();
  });

  it("a ticket with a valid email is stored", async () => {
    const body = { title: "Refund", requesterEmail: "asha@example.com" };
    expect((await ticketsPOST(jsonRequest("/api/tickets", body))).status).toBe(200);
    const widget = await widgetTicketsPOST(
      jsonRequest("/api/widget/tickets", { ...body, ...visitor() }, WIDGET_HEADERS),
    );
    expect(widget.status).toBe(200);
  });

  it.each([[{ content: {} }], [{ content: 5 }], [{ content: true }], [{ content: ["a"] }]])(
    "comments reject %j",
    async (body) => {
      const response = await commentsPOST(jsonRequest("/api/c", body), params);
      expect(response.status).toBe(400);
      expect(db.ticketComment.create).not.toHaveBeenCalled();
    },
  );
});

describe("PATCH /api/tickets/[id]", () => {
  const patch = (body: unknown) =>
    ticketPATCH(jsonRequest("/api/tickets/row_1", body, {}, "PATCH"), params);

  it.each([
    [{ status: 0 }],
    [{ status: false }],
    [{ status: true }],
    [{ status: "" }],
    [{ status: null }],
    [{ status: "NOPE" }],
    [{ status: {} }],
    [{ assigneeId: 0 }],
    [{ assigneeId: false }],
    [{ assigneeId: 5 }],
    [{ assigneeId: {} }],
  ])("rejects %j with 400 and changes nothing", async (body) => {
    expect((await patch(body)).status).toBe(400);
    expect(db.ticket.update).not.toHaveBeenCalled();
  });

  it.each([[null], [""]])("clears the assignee for %j", async (assigneeId) => {
    expect((await patch({ assigneeId })).status).toBe(200);
    expect(db.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeId: null } }),
    );
  });

  it("still applies a valid status", async () => {
    expect((await patch({ status: "IN_PROGRESS" })).status).toBe(200);
  });

  it("still assigns a member", async () => {
    store.member = { userId: "user_2" };
    expect((await patch({ assigneeId: "user_2" })).status).toBe(200);
    expect(db.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeId: "user_2" } }),
    );
  });
});

describe("settings", () => {
  const patchSettings = (body: unknown) =>
    settingsPATCH(jsonRequest("/api/settings", body, {}, "PATCH"));
  const patchWidget = (body: unknown) =>
    widgetSettingsPATCH(jsonRequest("/api/settings/widget", body, {}, "PATCH"));

  it.each([
    [{ tone: "angry" }],
    [{ greeting: 123 }],
    [{ greeting: "   " }],
    [{ widget: { allowedOrigins: "https://b.example" } }],
    [{ widget: { allowedOrigins: ["ftp://b.example"] } }],
  ])("PATCH /api/settings rejects %j and saves nothing", async (body) => {
    store.settings = { widget: { allowedOrigins: ["https://a.example"] } };
    expect((await patchSettings(body)).status).toBe(400);
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("a settings save keeps the origin list when it does not send one", async () => {
    store.settings = { widget: { allowedOrigins: ["https://a.example"] } };
    const response = await patchSettings({ tone: "concise" });
    expect(response.status).toBe(200);
    const { settings } = await response.json();
    expect(settings.tone).toBe("concise");
    expect(settings.widget.allowedOrigins).toEqual(["https://a.example"]);
  });

  it("a settings save can replace the origin list", async () => {
    const response = await patchSettings({
      widget: { allowedOrigins: ["*.example.com"] },
    });
    expect((await response.json()).settings.widget.allowedOrigins).toEqual(["*.example.com"]);
  });

  it.each([
    [{ widgetEnabled: "no" }],
    [{ widgetEnabled: 0 }],
    [{ widgetEnabled: null }],
    [{ allowedOrigins: "https://b.example" }],
    [{ allowedOrigins: ["javascript:alert(1)"] }],
    [{ allowedOrigins: [5] }],
    [{ allowedOrigins: null }],
    [{ widgetEnabled: false, allowedOrigins: "x" }],
  ])("PATCH /api/settings/widget rejects %j and saves nothing", async (body) => {
    expect((await patchWidget(body)).status).toBe(400);
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("PATCH /api/settings/widget saves valid values", async () => {
    const response = await patchWidget({
      widgetEnabled: false,
      allowedOrigins: ["https://a.example"],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      widgetEnabled: false,
      allowedOrigins: ["https://a.example"],
    });
  });
});

const UPLOAD_ROUTES: [string, Handler][] = [
  ["documents/upload", documentUploadPOST],
  ["recruitment/upload", recruitmentUploadPOST],
];

describe("uploads", () => {
  const boundary = "----penaven-test";
  const truncated = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\nhello`;

  it.each(UPLOAD_ROUTES)("%s rejects a JSON body with 400", async (_name, handler) => {
    expect((await handler(jsonRequest("/api/upload", "{}"))).status).toBe(400);
  });

  it.each(UPLOAD_ROUTES)("%s rejects no body with 400", async (_name, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/upload", { method: "POST" }),
    );
    expect(response.status).toBe(400);
  });

  it.each(UPLOAD_ROUTES)("%s rejects text/plain with 400", async (_name, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello",
      }),
    );
    expect(response.status).toBe(400);
  });

  it.each(UPLOAD_ROUTES)("%s rejects multipart with no boundary", async (_name, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: truncated,
      }),
    );
    expect(response.status).toBe(400);
  });

  it.each(UPLOAD_ROUTES)("%s rejects truncated multipart", async (_name, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: truncated,
      }),
    );
    expect(response.status).toBe(400);
  });

  it.each(UPLOAD_ROUTES)("%s answers an oversized body with 413", async (_name, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(20 * 1024 * 1024),
        },
        body: truncated,
      }),
    );
    expect(response.status).toBe(413);
  });

  function upload(file: File, fields: Record<string, string> = {}) {
    const form = new FormData();
    form.set("file", file);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return new Request("http://localhost:3000/api/upload", { method: "POST", body: form });
  }

  it("documents upload answers a corrupt PDF with 400 and a clear message", async () => {
    const response = await documentUploadPOST(
      upload(new File(["not really a pdf"], "bad.pdf", { type: "application/pdf" })),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/could not be read/);
  });

  it("documents upload answers a corrupt DOCX with 400", async () => {
    const response = await documentUploadPOST(
      upload(
        new File(["nope"], "bad.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/could not be read/);
  });

  it("documents upload rejects a NUL in the file name", async () => {
    const file = new File(["hello there"], "x.txt");
    Object.defineProperty(file, "name", { value: "a\0.txt" });
    const form = new FormData();
    form.set("file", file);
    vi.spyOn(FormData.prototype, "get").mockReturnValue(file);
    const response = await documentUploadPOST(
      new Request("http://localhost:3000/api/upload", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
    expect(db.document.create).not.toHaveBeenCalled();
  });

  it("documents upload strips NUL bytes from file text", async () => {
    const response = await documentUploadPOST(
      upload(
        new File([`hello\0 ${"this is a stored document. ".repeat(20)}`], "good.txt", {
          type: "text/plain",
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(chunkCreateMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(chunkCreateMany.mock.calls)).not.toContain("\\u0000");
  });

  it("recruitment upload answers a NUL job id with 404", async () => {
    const response = await recruitmentUploadPOST(
      upload(new File(["x"], "cv.pdf"), { jobId: "a\0b" }),
    );
    expect(response.status).toBe(404);
  });

  it("recruitment upload rejects a NUL in the file name", async () => {
    const file = new File(["x"], "cv.pdf");
    Object.defineProperty(file, "name", { value: "c\0v.pdf" });
    const form = new FormData();
    form.set("file", new File(["x"], "cv.pdf"));
    vi.spyOn(FormData.prototype, "get").mockImplementation((name) =>
      name === "file" ? file : "job_1",
    );
    const response = await recruitmentUploadPOST(
      new Request("http://localhost:3000/api/upload", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
  });
});

describe("recruitment payload errors", () => {
  it.each<[string, Handler, unknown]>([
    ["jobs", jobsPOST, { title: "x" }],
    ["jobs/[id]", (r) => jobPATCH(r, params), { title: "x" }],
    ["jobs/assist", assistPOST, { title: 5 }],
    ["candidates", candidatesPOST, { jobId: "bad" }],
    ["candidates/[id]", (r) => candidatePATCH(r, params), {}],
    ["analyze", analyzePOST, { candidateId: "bad" }],
  ])("%s does not return validator text", async (_name, handler, body) => {
    const response = await handler(jsonRequest("/api/test", body));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("accepts a CUID-shaped candidate id", async () => {
    const response = await analyzePOST(jsonRequest("/api/test", { candidateId: CUID }));
    expect(response.status).toBe(404);
  });
});

describe("knowledge routes", () => {
  it("draft-faq rejects a long topic before any AI call", async () => {
    const response = await draftFaqPOST(
      jsonRequest("/api/knowledge/draft-faq", { topic: "t".repeat(201) }),
    );
    expect(response.status).toBe(400);
    expect(db.ticket.findMany).not.toHaveBeenCalled();
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("draft-faq has the same time limit as publish-faq", () => {
    expect(draftMaxDuration).toBe(publishMaxDuration);
  });

  it("draft-faq does not return a raw error", async () => {
    vi.mocked(db.ticket.findMany).mockRejectedValueOnce(
      new Error("Invalid `prisma.ticket.findMany()` invocation"),
    );
    const response = await draftFaqPOST(
      jsonRequest("/api/knowledge/draft-faq", { topic: "refunds" }),
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to draft FAQ");
  });

  it("publish-faq rejects oversized content and leaves no row", async () => {
    const response = await publishFaqPOST(
      jsonRequest("/api/knowledge/publish-faq", {
        title: "Refund policy",
        content: "c".repeat(2 * 1024 * 1024),
      }),
    );
    expect(response.status).toBe(413);
    expect(db.document.create).not.toHaveBeenCalled();
  });

  it("publish-faq accepts content at the limit", async () => {
    const response = await publishFaqPOST(
      jsonRequest("/api/knowledge/publish-faq", {
        title: "Refund policy",
        content: "word ".repeat(4000),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("publish-faq stores and returns no raw database text", async () => {
    const raw = "Invalid `prisma.documentChunk.create()` invocation: Transaction already closed";
    vi.mocked(db.$transaction).mockRejectedValueOnce(new Error(raw));
    const response = await publishFaqPOST(
      jsonRequest("/api/knowledge/publish-faq", {
        title: "Refund policy",
        content: "word ".repeat(20),
      }),
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to publish FAQ");
    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "FAILED", errorMessage: "Failed to process document" },
      }),
    );
  });
});

describe("demo seed", () => {
  it("tells a caller with the wrong secret what is wrong", async () => {
    vi.stubEnv("DEMO_SEED_SECRET", "right");
    vi.stubEnv("NODE_ENV", "production");
    const response = await demoSeedPOST(
      new Request("http://localhost:3000/api/demo/seed", {
        method: "POST",
        headers: { "x-demo-seed-secret": "wrong" },
      }),
    );
    expect(response.status).toBe(403);
    const { error } = await response.json();
    expect(error).toBe("Missing or incorrect demo seed secret.");
    expect(error).not.toMatch(/disabled/);
  });

  it("explains when production has no secret set", async () => {
    vi.stubEnv("DEMO_SEED_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const response = await demoSeedPOST(
      new Request("http://localhost:3000/api/demo/seed", { method: "POST" }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/without DEMO_SEED_SECRET/);
  });
});
