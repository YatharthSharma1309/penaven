import { beforeEach, describe, expect, it } from "vitest";
import { POST as chat } from "@/app/api/chat/route";
import { POST as chatStream } from "@/app/api/chat/stream/route";
import { GET as listConversations } from "@/app/api/conversations/route";
import { GET as listDocuments } from "@/app/api/documents/route";
import { POST as uploadDocument } from "@/app/api/documents/upload/route";
import { POST as publishFaq } from "@/app/api/knowledge/publish-faq/route";
import { POST as analyze } from "@/app/api/recruitment/analyze/route";
import { POST as createCandidate } from "@/app/api/recruitment/candidates/route";
import { GET as getJob } from "@/app/api/recruitment/jobs/[id]/route";
import { GET as listJobs } from "@/app/api/recruitment/jobs/route";
import { POST as uploadResume } from "@/app/api/recruitment/upload/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/settings/route";
import {
  GET as getWidgetSettings,
  PATCH as patchWidgetSettings,
  POST as rotateWidgetKey,
} from "@/app/api/settings/widget/route";
import { PATCH as patchTicket } from "@/app/api/tickets/[id]/route";
import { GET as listTickets, POST as createTicket } from "@/app/api/tickets/route";
import { db } from "@/lib/db";
import { listJobAuditEvents } from "@/lib/recruitment/services/audit";
import {
  canaryOf,
  expectDenied,
  expectNothingFrom,
  formRequest,
  idContext,
  jsonRequest,
  readResponse,
  visitorFields,
  widgetHeaders,
} from "./helpers/http";
import {
  handlerFor,
  ID_ROUTE_CASES,
  pathFor,
  type IdRouteCase,
} from "./helpers/id-routes";
import { seedTenants, snapshotTenant, type Tenant } from "./helpers/seed";
import { actAs } from "./helpers/session";

let a: Tenant;
let b: Tenant;

/** Seeded fresh, so one test's writes and rate limits never reach the next. */
beforeEach(async () => {
  ({ a, b } = await seedTenants());
  // An admin of B, so a denial below can only come from the workspace check.
  actAs(b.admin);
});

function callIdRoute(routeCase: IdRouteCase, caller: Tenant, id: string) {
  const body = routeCase.widget
    ? { ...(routeCase.body as object), ...visitorFields(caller) }
    : routeCase.body;

  return handlerFor(routeCase)(
    jsonRequest(
      routeCase.method,
      pathFor(routeCase, id),
      body,
      routeCase.widget ? widgetHeaders(caller) : undefined,
    ),
    idContext(id),
  );
}

describe("[id] routes", () => {
  describe.each(ID_ROUTE_CASES)("$method $file $note", (routeCase) => {
    it("denies workspace B on workspace A's record", async () => {
      await expectDenied(a, 404, () => callIdRoute(routeCase, b, routeCase.target(a)));
    });

    it("still works for the owner", async () => {
      actAs(a.admin);
      const { status, text } = await readResponse(
        await callIdRoute(routeCase, a, routeCase.target(a)),
      );

      expect(status).toBe(routeCase.ownerStatus);
      if (routeCase.ownerSees) expect(text).toMatch(canaryOf(a));
      expectNothingFrom(b, text);
    });
  });

  it("rejects a caller with no session", async () => {
    actAs(null);
    const [routeCase] = ID_ROUTE_CASES;
    await expectDenied(a, 401, () => callIdRoute(routeCase, b, routeCase.target(a)));
  });

  it("does not run A's expired hire when B asks for A's job or lists jobs", async () => {
    await db.job.update({
      where: { id: a.job.id },
      data: { pendingHireExpiresAt: new Date(Date.now() - 60_000) },
    });

    await expectDenied(a, 404, () =>
      getJob(jsonRequest("GET", `/api/recruitment/jobs/${a.job.id}`), idContext(a.job.id)),
    );

    const before = await snapshotTenant(a);
    const { status, text } = await readResponse(await listJobs());
    expect(status).toBe(200);
    expectNothingFrom(a, text);
    expect(await snapshotTenant(a)).toEqual(before);
  });
});

describe("list routes return only the caller's rows", () => {
  it("lists conversations", async () => {
    const { status, text, body } = await readResponse(await listConversations());
    const { conversations } = JSON.parse(body) as {
      conversations: Array<{ organizationId: string }>;
    };

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
    expect(conversations.map((row) => row.organizationId)).toEqual([b.organization.id]);
  });

  it("lists documents", async () => {
    const { status, text, body } = await readResponse(await listDocuments());
    const { documents } = JSON.parse(body) as {
      documents: Array<{ organizationId: string }>;
    };

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
    expect(documents.map((row) => row.organizationId)).toEqual([b.organization.id]);
  });

  it("lists tickets", async () => {
    const { status, text, body } = await readResponse(
      await listTickets(jsonRequest("GET", "/api/tickets")),
    );
    const { tickets } = JSON.parse(body) as { tickets: Array<{ organizationId: string }> };

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
    expect(tickets.map((row) => row.organizationId)).toEqual([b.organization.id]);
  });

  it("lists jobs", async () => {
    const { status, text, body } = await readResponse(await listJobs());
    const { jobs } = JSON.parse(body) as { jobs: Array<{ id: string }> };

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
    expect(jobs.map((row) => row.id)).toEqual([b.job.id]);
  });

  it("reads settings", async () => {
    const { status, text } = await readResponse(await getSettings());

    expect(status).toBe(200);
    expect(text).toMatch(canaryOf(b));
    expectNothingFrom(a, text);
  });

  it("reads widget settings", async () => {
    const { status, text } = await readResponse(await getWidgetSettings());

    expect(status).toBe(200);
    expect(text).toContain(b.widgetKey);
    expectNothingFrom(a, text);
  });

  it("reads job activity", async () => {
    await expect(listJobAuditEvents(b.organization.id, a.job.id)).resolves.toEqual([]);
    await expect(listJobAuditEvents(b.organization.id, b.job.id)).resolves.toHaveLength(1);
  });
});

describe("routes that take A's id in the body", () => {
  it("will not link B's ticket to A's conversation", async () => {
    await expectDenied(a, 400, () =>
      createTicket(
        jsonRequest("POST", "/api/tickets", {
          title: "Escalation: a ticket in B",
          conversationId: a.conversation.id,
        }),
      ),
    );
    expect(await db.ticket.count({ where: { conversationId: a.conversation.id } })).toBe(1);
  });

  it("will not assign B's ticket to A's user", async () => {
    await expectDenied(a, 400, () =>
      patchTicket(
        jsonRequest("PATCH", `/api/tickets/${b.ticket.id}`, { assigneeId: a.user.id }),
        idContext(b.ticket.id),
      ),
    );
  });

  it("will not continue A's conversation through chat", async () => {
    await expectDenied(a, 404, () =>
      chat(
        jsonRequest("POST", "/api/chat", {
          message: "Hello",
          conversationId: a.conversation.id,
        }),
      ),
    );
  });

  it("will not continue A's conversation through the chat stream", async () => {
    await expectDenied(a, 404, () =>
      chatStream(
        jsonRequest("POST", "/api/chat/stream", {
          message: "Hello",
          conversationId: a.conversation.id,
        }),
      ),
    );
  });

  it("will not add a candidate to A's job", async () => {
    await expectDenied(a, 404, () =>
      createCandidate(
        jsonRequest("POST", "/api/recruitment/candidates", {
          jobId: a.job.id,
          displayName: "Added by another workspace",
          rawText: "Plenty of fictional resume text, enough to pass the fifty character limit.",
        }),
      ),
    );
  });

  it("will not upload a resume to A's job", async () => {
    const form = new FormData();
    form.set("jobId", a.job.id);
    form.set("file", new File(["%PDF-1.4"], "resume.pdf", { type: "application/pdf" }));

    await expectDenied(a, 404, () =>
      uploadResume(formRequest("/api/recruitment/upload", form)),
    );
  });

  it("will not analyze A's candidate", async () => {
    await expectDenied(a, 404, () =>
      analyze(
        jsonRequest("POST", "/api/recruitment/analyze", { candidateId: a.candidate.id }),
      ),
    );
  });

  it("would reach analysis for B's own candidate, stopping only at the missing model", async () => {
    const { status, text } = await readResponse(
      await analyze(
        jsonRequest("POST", "/api/recruitment/analyze", { candidateId: b.candidate.id }),
      ),
    );

    expect(status).toBe(503);
    expectNothingFrom(a, text);
  });
});

describe("writes stay in the caller's workspace", () => {
  it("stores an uploaded document under B and leaves A alone", async () => {
    const before = await snapshotTenant(a);
    const form = new FormData();
    form.set(
      "file",
      new File(["Uploaded by workspace B, with enough words to chunk."], "b-upload.txt", {
        type: "text/plain",
      }),
    );

    const { status, body, text } = await readResponse(
      await uploadDocument(formRequest("/api/documents/upload", form)),
    );
    const { document } = JSON.parse(body) as {
      document: { organizationId: string; status: string };
    };

    expect(status).toBe(200);
    expect(document).toMatchObject({ organizationId: b.organization.id, status: "READY" });
    expectNothingFrom(a, text);
    expect(await snapshotTenant(a)).toEqual(before);
  });

  it("publishes a FAQ under B and leaves A alone", async () => {
    const before = await snapshotTenant(a);
    const { status, body } = await readResponse(
      await publishFaq(
        jsonRequest("POST", "/api/knowledge/publish-faq", {
          title: "A FAQ from B",
          content: "This answer belongs to workspace B and is long enough to publish.",
        }),
      ),
    );
    const { document } = JSON.parse(body) as { document: { organizationId: string } };

    expect(status).toBe(200);
    expect(document.organizationId).toBe(b.organization.id);
    expect(await snapshotTenant(a)).toEqual(before);
  });

  it("changes B's settings only", async () => {
    const before = await snapshotTenant(a);
    const { status, text } = await readResponse(
      await patchSettings(
        jsonRequest("PATCH", "/api/settings", { greeting: "A new greeting for B" }),
      ),
    );

    expect(status).toBe(200);
    expectNothingFrom(a, text);
    expect(await snapshotTenant(a)).toEqual(before);
  });

  it("changes B's widget settings only", async () => {
    const before = await snapshotTenant(a);
    const { status, text } = await readResponse(
      await patchWidgetSettings(
        jsonRequest("PATCH", "/api/settings/widget", {
          widgetEnabled: false,
          allowedOrigins: ["https://new-b.example.test"],
        }),
      ),
    );

    expect(status).toBe(200);
    expectNothingFrom(a, text);
    expect(await snapshotTenant(a)).toEqual(before);
  });

  it("rotates B's widget key only", async () => {
    const before = await snapshotTenant(a);
    const { status, text, body } = await readResponse(await rotateWidgetKey());

    expect(status).toBe(200);
    expect((JSON.parse(body) as { widgetPublicKey: string }).widgetPublicKey).not.toBe(
      b.widgetKey,
    );
    expectNothingFrom(a, text);
    expect(await snapshotTenant(a)).toEqual(before);
  });
});

describe("admin-only routes as an agent of the same workspace", () => {
  beforeEach(() => {
    actAs(b.agent);
  });

  it("refuses the settings routes", async () => {
    expect((await getSettings()).status).toBe(403);
    expect((await getWidgetSettings()).status).toBe(403);
    expect((await rotateWidgetKey()).status).toBe(403);
  });

  it("refuses a document upload", async () => {
    const form = new FormData();
    form.set("file", new File(["text"], "note.txt", { type: "text/plain" }));

    const response = await uploadDocument(formRequest("/api/documents/upload", form));
    expect(response.status).toBe(403);
  });
});
