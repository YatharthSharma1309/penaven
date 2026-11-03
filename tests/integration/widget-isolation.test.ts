import { beforeEach, describe, expect, it } from "vitest";
import { POST as streamRoute } from "@/app/api/widget/chat/stream/route";
import { POST as feedbackRoute } from "@/app/api/widget/messages/[id]/feedback/route";
import { POST as sessionRoute } from "@/app/api/widget/session/route";
import { POST as ticketsRoute } from "@/app/api/widget/tickets/route";
import { PLANS } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import {
  canaryOf,
  expectDenied,
  expectNothingFrom,
  idContext,
  jsonRequest,
  readResponse,
  visitorFields,
  widgetHeaders,
} from "./helpers/http";
import { SHARED_QUERY, seedTenants, snapshotTenant, type Tenant } from "./helpers/seed";
import { actAs } from "./helpers/session";

let a: Tenant;
let b: Tenant;

beforeEach(async () => {
  ({ a, b } = await seedTenants());
  actAs(null);
});

type Caller = {
  headers: Record<string, string>;
  visitor: { visitorId: string; visitorToken: string };
};

function caller(keyOwner: Tenant, tokenOwner = keyOwner, visitorId?: string): Caller {
  return {
    headers: widgetHeaders(keyOwner),
    visitor: visitorFields(tokenOwner, visitorId ?? tokenOwner.visitorId),
  };
}

function stream(from: Caller, conversationId: string) {
  return streamRoute(
    jsonRequest(
      "POST",
      "/api/widget/chat/stream",
      { ...from.visitor, message: SHARED_QUERY, conversationId },
      from.headers,
    ),
  );
}

function createTicket(from: Caller, conversationId: string) {
  return ticketsRoute(
    jsonRequest(
      "POST",
      "/api/widget/tickets",
      { ...from.visitor, title: "Escalation: please help", conversationId },
      from.headers,
    ),
  );
}

function feedback(from: Caller, messageId: string) {
  return feedbackRoute(
    jsonRequest(
      "POST",
      `/api/widget/messages/${messageId}/feedback`,
      { ...from.visitor, helpful: false },
      from.headers,
    ),
    idContext(messageId),
  );
}

describe("workspace B's widget against workspace A's conversation", () => {
  it("cannot stream into it", async () => {
    await expectDenied(a, 404, () => stream(caller(b), a.widgetConversation.id));
  });

  it("cannot raise a ticket on it", async () => {
    await expectDenied(a, 400, () => createTicket(caller(b), a.widgetConversation.id));
  });

  it("cannot rate its message", async () => {
    await expectDenied(a, 404, () => feedback(caller(b), a.widgetMessage.id));
  });

  it("gets no further when the visitor id matches A's visitor", async () => {
    expect(b.visitorId).toBe(a.visitorId);
    expect(a.widgetConversation.visitorId).toBe(b.visitorId);

    await expectDenied(a, 404, () => feedback(caller(b), a.widgetMessage.id));
  });
});

describe("a visitor token signed for the other workspace", () => {
  it("does not open the stream", async () => {
    await expectDenied(a, 401, () => stream(caller(b, a), a.widgetConversation.id));
  });

  it("does not open tickets", async () => {
    await expectDenied(a, 401, () => createTicket(caller(b, a), a.widgetConversation.id));
  });

  it("does not open feedback", async () => {
    await expectDenied(a, 401, () => feedback(caller(b, a), a.widgetMessage.id));
  });
});

describe("one visitor against another visitor's conversation in the same workspace", () => {
  const otherVisitor = () => caller(a, a, a.otherVisitorId);

  it("cannot stream into it", async () => {
    await expectDenied(a, 404, () => stream(otherVisitor(), a.widgetConversation.id));
  });

  it("cannot raise a ticket on it", async () => {
    await expectDenied(a, 400, () =>
      createTicket(otherVisitor(), a.widgetConversation.id),
    );
  });

  it("cannot rate its message", async () => {
    await expectDenied(a, 404, () => feedback(otherVisitor(), a.widgetMessage.id));
  });

  it("cannot sign as that visitor with its own token", async () => {
    const forged: Caller = {
      headers: widgetHeaders(a),
      visitor: {
        visitorId: a.visitorId,
        visitorToken: visitorFields(a, a.otherVisitorId).visitorToken,
      },
    };

    await expectDenied(a, 401, () => stream(forged, a.widgetConversation.id));
    await expectDenied(a, 401, () => createTicket(forged, a.widgetConversation.id));
    await expectDenied(a, 401, () => feedback(forged, a.widgetMessage.id));
  });

  it("cannot reach an admin conversation, which has no visitor", async () => {
    await expectDenied(a, 404, () => stream(caller(a), a.conversation.id));
    await expectDenied(a, 400, () => createTicket(caller(a), a.conversation.id));
    await expectDenied(a, 404, () => feedback(caller(a), a.message.id));
  });
});

describe("the monthly cap path", () => {
  beforeEach(async () => {
    const month = new Date();
    for (const tenant of [a, b]) {
      await db.message.createMany({
        data: Array.from({ length: PLANS.free.assistantAnswersPerMonth }, () => ({
          conversationId: tenant.otherVisitorConversation.id,
          role: "USER" as const,
          content: "An earlier question",
          createdAt: month,
        })),
      });
    }
  });

  it("does not write into another workspace's conversation", async () => {
    await expectDenied(a, 404, () => stream(caller(b), a.widgetConversation.id));
  });

  it("does not write into another visitor's conversation", async () => {
    await expectDenied(a, 404, () =>
      stream(caller(a, a, a.otherVisitorId), a.widgetConversation.id),
    );
  });

  it("still answers the visitor in their own conversation", async () => {
    const { status, text } = await readResponse(await stream(caller(a), a.widgetConversation.id));

    expect(status).toBe(200);
    // The visitor's cap reply (assistantCapReply("WIDGET")).
    expect(text).toContain("I can't answer more questions here right now.");
    expectNothingFrom(b, text);
  });
});

describe("the widget key and origin", () => {
  it("refuses B's key from A's site", async () => {
    await expectDenied(a, 401, () =>
      stream(
        {
          headers: { "x-widget-key": b.widgetKey, origin: a.origin },
          visitor: visitorFields(b),
        },
        a.widgetConversation.id,
      ),
    );
  });

  it("signs a session token only for the key's workspace", async () => {
    const { status, body } = await readResponse(
      await sessionRoute(
        jsonRequest("POST", "/api/widget/session", { visitorId: a.visitorId }, widgetHeaders(b)),
      ),
    );

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual(visitorFields(b, a.visitorId));
    expect(visitorFields(b, a.visitorId)).not.toEqual(visitorFields(a, a.visitorId));
  });
});

describe("the owner's visitor", () => {
  it("can stream in their own conversation", async () => {
    const { status, text } = await readResponse(await stream(caller(a), a.widgetConversation.id));

    expect(status).toBe(200);
    expect(text).toContain("event: done");
    expect(text).toMatch(canaryOf(a));
    expectNothingFrom(b, text);
  });

  it("can raise a ticket on their own conversation", async () => {
    const { status, text } = await readResponse(
      await createTicket(caller(a, a, a.otherVisitorId), a.otherVisitorConversation.id),
    );

    expect(status).toBe(200);
    expectNothingFrom(b, text);
  });

  it("can rate their own message", async () => {
    const response = await feedback(caller(a), a.widgetMessage.id);
    expect(response.status).toBe(200);

    const after = await snapshotTenant(a);
    expect(after.messages.find((row) => row.id === a.widgetMessage.id)?.helpful).toBe(false);
  });
});
