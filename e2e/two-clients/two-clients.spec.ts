import { expect, test, type BrowserContext } from "@playwright/test";
import {
  BOGUS_WIDGET_KEY,
  CLIENTS,
  COVERED_QUESTION,
  UNCOVERED_QUESTION,
  otherClient,
  type Client,
  type ClientId,
} from "./clients";
import { jobPayload, tinyResumePdf } from "./fixtures";
import {
  askWidget,
  closeAll,
  expectNotFoundPage,
  handOff,
  linkHrefs,
  openWidget,
  ownerContext,
  startVisitorSession,
} from "./helpers";

/**
 * Brightside Dental and Northpeak Outdoor, side by side: the same steps, the
 * same questions, and every record checked against the other workspace.
 * Nothing here depends on a model, on widget wording or on inbox previews.
 */

type Created = {
  documentId: string;
  documentTitle: string;
  conversationId: string;
  ticketId: string;
  runId: string;
  jobId: string;
  candidateId: string;
  shareUrl: string;
};

const created: Record<ClientId, Partial<Created>> = { clinic: {}, shop: {} };
const owners: Partial<Record<ClientId, BrowserContext>> = {};
const clients = Object.values(CLIENTS);

function record(client: Client) {
  return created[client.id] as Created;
}

function owner(client: Client) {
  const context = owners[client.id];
  if (!context) throw new Error(`No owner session for ${client.id}`);
  return context;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  for (const client of clients) {
    owners[client.id] = await ownerContext(browser, client);
  }
});

test.afterAll(async () => {
  await closeAll(Object.values(owners));
});

test("each owner signs in to their own workspace", async () => {
  for (const client of clients) {
    const page = await owner(client).newPage();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

    const widget = await page.request.get("/api/settings/widget");
    expect(widget.status()).toBe(200);
    const body = await widget.json();
    expect(body.slug).toBe(client.slug);
    expect(body.widgetPublicKey).toBe(client.widgetKey);
    await page.close();
  }
});

test("each owner uploads their FAQ on Knowledge and sets a greeting", async () => {
  for (const client of clients) {
    const page = await owner(client).newPage();
    // Wait for hydration, so the form posts through the app's own handler.
    await page.goto("/knowledge", { waitUntil: "networkidle" });

    await page.locator("#document-file").setInputFiles({
      name: client.faq.fileName,
      mimeType: "text/markdown",
      buffer: Buffer.from(client.faq.body),
    });
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/documents/upload") &&
        response.request().method() === "POST",
    );
    await page.locator("#document-file").evaluate((input) => {
      (input as HTMLInputElement).form?.requestSubmit();
    });
    const response = await uploaded;
    expect(response.status()).toBe(200);
    const { document } = (await response.json()) as {
      document: { id: string; title: string; status: string };
    };
    record(client).documentId = document.id;
    record(client).documentTitle = document.title;

    await expect
      .poll(async () => {
        const list = await page.request.get("/api/documents");
        const { documents } = (await list.json()) as {
          documents: Array<{ id: string; status: string }>;
        };
        return documents.find((item) => item.id === document.id)?.status;
      })
      .toBe("READY");

    const settings = await page.request.patch("/api/settings", {
      data: { greeting: client.greeting },
    });
    expect(settings.status()).toBe(200);
    await page.close();
  }
});

test("Knowledge and settings show each workspace only its own", async () => {
  for (const client of clients) {
    const other = otherClient(client);
    const page = await owner(client).newPage();

    const list = await page.request.get("/api/documents");
    const { documents } = (await list.json()) as { documents: Array<{ id: string }> };
    const ids = documents.map((item) => item.id);
    expect(ids).toContain(record(client).documentId);
    expect(ids).not.toContain(record(other).documentId);

    await page.goto("/knowledge");
    await expect(page.getByText(record(client).documentTitle).first()).toBeVisible();
    await expect(page.getByText(record(other).documentTitle)).toHaveCount(0);

    const settings = await page.request.get("/api/settings");
    expect((await settings.json()).settings.greeting).toBe(client.greeting);
    await page.close();
  }
});

test("each widget key opens its own business, with its own greeting", async ({ browser }) => {
  for (const client of clients) {
    const other = otherClient(client);
    const { context, page, response } = await openWidget(browser, client);
    expect(response?.status()).toBe(200);

    const html = await page.content();
    expect(html).toContain(client.greeting);
    expect(html).not.toContain(other.greeting);
    await context.close();
  }
});

test("a covered question cites only that business's document, without a model", async ({
  browser,
}) => {
  for (const client of clients) {
    const other = otherClient(client);
    const { context, page } = await openWidget(browser, client);

    const session = await startVisitorSession(page, client.widgetKey);
    expect(session.status).toBe(200);
    const { visitorId, visitorToken } = session.body as {
      visitorId: string;
      visitorToken: string;
    };

    const turn = await askWidget(page, {
      widgetKey: client.widgetKey,
      visitorId,
      visitorToken,
      message: COVERED_QUESTION,
    });
    expect(turn.status).toBe(200);
    expect(turn.done).toBe(true);

    const sources = turn.meta.sources ?? [];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.documentTitle).toBe(record(client).documentTitle);
      expect(source.documentTitle).not.toBe(record(other).documentTitle);
      expect(source.content).not.toContain(other.name);
    }
    // The cited passage is the business's own text.
    expect(sources.some((source) => client.faq.body.includes(source.content.trim().slice(0, 40)))).toBe(true);

    // The saved reply keeps the citation for the owner.
    const conversationId = turn.meta.conversationId as string;
    const saved = await owner(client).request.get(`/api/conversations/${conversationId}`);
    expect(saved.status()).toBe(200);
    const { conversation } = (await saved.json()) as {
      conversation: { messages: Array<{ role: string; sources: unknown }> };
    };
    const assistant = conversation.messages.find((message) => message.role === "ASSISTANT");
    expect(JSON.stringify(assistant?.sources ?? null)).toContain(record(client).documentTitle);

    await context.close();
  }
});

test("an uncovered question hands off with an email, to that owner only", async ({ browser }) => {
  for (const client of clients) {
    const { context, page } = await openWidget(browser, client);
    const session = await startVisitorSession(page, client.widgetKey);
    const { visitorId, visitorToken } = session.body as {
      visitorId: string;
      visitorToken: string;
    };

    const turn = await askWidget(page, {
      widgetKey: client.widgetKey,
      visitorId,
      visitorToken,
      message: UNCOVERED_QUESTION,
    });
    expect(turn.status).toBe(200);
    expect(turn.meta.chunksMatched).toBe(0);
    expect(turn.meta.sources ?? []).toEqual([]);

    const conversationId = turn.meta.conversationId as string;
    const email = `visitor-${client.id}@example.com`;
    const ticket = await handOff(page, {
      widgetKey: client.widgetKey,
      visitorId,
      visitorToken,
      conversationId,
      question: UNCOVERED_QUESTION,
      email,
    });
    expect(ticket.status).toBe(200);
    record(client).conversationId = conversationId;
    record(client).ticketId = ticket.body.ticket?.id as string;

    const detail = await owner(client).request.get(`/api/tickets/${record(client).ticketId}`);
    expect(detail.status()).toBe(200);
    expect(JSON.stringify(await detail.json())).toContain(email);
    await context.close();
  }
});

test("Tickets, Inbox and the run log list each owner's records only", async () => {
  for (const client of clients) {
    const other = otherClient(client);
    const page = await owner(client).newPage();

    const tickets = await page.request.get("/api/tickets");
    const ticketIds = ((await tickets.json()).tickets as Array<{ id: string }>).map(
      (ticket) => ticket.id,
    );
    expect(ticketIds).toContain(record(client).ticketId);
    expect(ticketIds).not.toContain(record(other).ticketId);

    await page.goto("/tickets");
    let hrefs = await linkHrefs(page);
    expect(hrefs).toContain(`/tickets/${record(client).ticketId}`);
    expect(hrefs).not.toContain(`/tickets/${record(other).ticketId}`);

    await page.goto("/inbox");
    hrefs = await linkHrefs(page);
    expect(hrefs).toContain(`/inbox/${record(client).conversationId}`);
    expect(hrefs).not.toContain(`/inbox/${record(other).conversationId}`);

    const inboxThread = await page.goto(`/inbox/${record(client).conversationId}`);
    expect(inboxThread?.status()).toBe(200);

    await page.goto("/widget/intake");
    hrefs = await linkHrefs(page);
    const runLink = hrefs.find((href) => /^\/widget\/intake\/[^/]+$/.test(href));
    expect(runLink, "the run log links its latest run").toBeTruthy();
    record(client).runId = runLink!.split("/").pop()!;
    const run = await page.goto(runLink!);
    expect(run?.status()).toBe(200);
    await page.close();
  }

  expect(record(CLIENTS.clinic).runId).not.toBe(record(CLIENTS.shop).runId);
});

test("each owner opens a role and screens a resume", async () => {
  for (const client of clients) {
    const page = await owner(client).newPage();

    const job = await page.request.post("/api/recruitment/jobs", {
      data: jobPayload(client.jobTitle, ["customer service", "scheduling"]),
    });
    expect(job.status()).toBe(201);
    const jobId = ((await job.json()) as { job: { id: string } }).job.id;
    record(client).jobId = jobId;

    // The upload starts from React's change handler, so wait for hydration first.
    await page.goto(`/recruitment/jobs/${jobId}`, { waitUntil: "networkidle" });
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/recruitment/upload") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.locator(`#resume-upload-${jobId}`).setInputFiles({
      name: client.resume.fileName,
      mimeType: "application/pdf",
      buffer: tinyResumePdf(client.resume.lines),
    });
    const response = await uploaded;
    expect(response.status()).toBe(201);
    const { candidate } = (await response.json()) as {
      candidate: { id: string; parseStatus: string };
    };
    record(client).candidateId = candidate.id;
    expect(candidate.parseStatus).toBe("ok");

    // The uploader's own refresh can land before the list does, so load the page again.
    await page.reload();
    const candidateHref = `/recruitment/jobs/${jobId}/candidates/${candidate.id}`;
    await expect(page.locator(`a[href="${candidateHref}"]`).first()).toBeVisible();
    const detail = await page.goto(candidateHref);
    expect(detail?.status()).toBe(200);

    const shortlisted = await page.request.patch(`/api/recruitment/candidates/${candidate.id}`, {
      data: { status: "shortlisted" },
    });
    expect(shortlisted.status()).toBe(200);

    const share = await page.request.post(`/api/recruitment/jobs/${jobId}/share`);
    expect(share.status()).toBe(200);
    record(client).shareUrl = ((await share.json()) as { url: string }).url;
    await page.close();
  }
});

test("Hiring lists, CSV and share links stay inside each workspace", async ({ browser }) => {
  for (const client of clients) {
    const other = otherClient(client);
    const page = await owner(client).newPage();

    const jobs = await page.request.get("/api/recruitment/jobs");
    const jobIds = ((await jobs.json()).jobs as Array<{ id: string }>).map((job) => job.id);
    expect(jobIds).toContain(record(client).jobId);
    expect(jobIds).not.toContain(record(other).jobId);

    await page.goto("/recruitment");
    const hrefs = await linkHrefs(page);
    expect(hrefs).toContain(`/recruitment/jobs/${record(client).jobId}`);
    expect(hrefs).not.toContain(`/recruitment/jobs/${record(other).jobId}`);

    const csv = await page.request.get(`/api/recruitment/jobs/${record(client).jobId}/export`);
    expect(csv.status()).toBe(200);
    const csvText = await csv.text();
    expect(csvText).toContain(client.resume.candidateName);
    expect(csvText).not.toContain(other.resume.candidateName);
    await page.close();

    // The public link, opened by someone with no session.
    const visitor = await browser.newContext();
    const sharePage = await visitor.newPage();
    const shared = await sharePage.goto(record(client).shareUrl);
    expect(shared?.status()).toBe(200);
    await expect(sharePage.getByText(client.jobTitle).first()).toBeVisible();
    await expect(sharePage.getByText(client.resume.candidateName).first()).toBeVisible();
    const shareHtml = await sharePage.content();
    expect(shareHtml).not.toContain(other.jobTitle);
    expect(shareHtml).not.toContain(other.resume.candidateName);
    await visitor.close();
  }
});

test("direct IDs from the other workspace are not found, by API and by page", async () => {
  for (const client of clients) {
    const other = record(otherClient(client));
    const request = owner(client).request;

    const probes: Array<[string, () => Promise<{ status(): number }>]> = [
      ["DELETE document", () => request.delete(`/api/documents/${other.documentId}`)],
      ["GET ticket", () => request.get(`/api/tickets/${other.ticketId}`)],
      ["PATCH ticket", () => request.patch(`/api/tickets/${other.ticketId}`, { data: { status: "CLOSED" } })],
      ["GET conversation", () => request.get(`/api/conversations/${other.conversationId}`)],
      ["GET job", () => request.get(`/api/recruitment/jobs/${other.jobId}`)],
      ["PATCH job", () => request.patch(`/api/recruitment/jobs/${other.jobId}`, { data: jobPayload("Taken over role", ["anything"]) })],
      ["GET candidate", () => request.get(`/api/recruitment/candidates/${other.candidateId}`)],
      ["GET candidate file", () => request.get(`/api/recruitment/candidates/${other.candidateId}/file`)],
      ["PATCH candidate", () => request.patch(`/api/recruitment/candidates/${other.candidateId}`, { data: { status: "rejected" } })],
      ["GET export CSV", () => request.get(`/api/recruitment/jobs/${other.jobId}/export`)],
      ["POST share link", () => request.post(`/api/recruitment/jobs/${other.jobId}/share`)],
      [
        "POST resume to the other job",
        () =>
          request.post("/api/recruitment/upload", {
            multipart: {
              jobId: other.jobId,
              file: { name: "intruder.pdf", mimeType: "application/pdf", buffer: tinyResumePdf(["Intruder resume line long enough to parse as text."]) },
            },
          }),
      ],
    ];

    for (const [name, probe] of probes) {
      const response = await probe();
      expect(response.status(), `${client.id}: ${name}`).toBe(404);
    }

    const page = await owner(client).newPage();
    for (const path of [
      `/tickets/${other.ticketId}`,
      `/inbox/${other.conversationId}`,
      `/widget/intake/${other.runId}`,
      `/recruitment/jobs/${other.jobId}`,
      `/recruitment/jobs/${other.jobId}/candidates/${other.candidateId}`,
    ]) {
      await expectNotFoundPage(page, path);
    }
    await page.close();
  }

  // Nothing the probes tried changed the other workspace.
  for (const client of clients) {
    const request = owner(client).request;
    const mine = record(client);

    const docs = (await (await request.get("/api/documents")).json()).documents as Array<{ id: string }>;
    expect(docs.map((doc) => doc.id)).toContain(mine.documentId);

    const ticket = await request.get(`/api/tickets/${mine.ticketId}`);
    expect(JSON.stringify(await ticket.json())).not.toContain('"CLOSED"');

    const job = await request.get(`/api/recruitment/jobs/${mine.jobId}`);
    expect(JSON.stringify(await job.json())).toContain(client.jobTitle);

    const candidate = await request.get(`/api/recruitment/candidates/${mine.candidateId}`);
    expect(JSON.stringify(await candidate.json())).not.toContain('"rejected"');

    const jobs = (await (await request.get("/api/recruitment/jobs")).json()).jobs as Array<{ id: string; candidateCount?: number }>;
    expect(jobs).toHaveLength(1);
  }
});

test("rotating a widget key changes only the caller's key", async ({ browser }) => {
  const { clinic, shop } = CLIENTS;

  const rotated = await owner(clinic).request.post("/api/settings/widget");
  expect(rotated.status()).toBe(200);
  const newKey = ((await rotated.json()) as { widgetPublicKey: string }).widgetPublicKey;
  expect(newKey).not.toBe(clinic.widgetKey);

  const clinicVisitor = await openWidget(browser, clinic, newKey);
  expect(clinicVisitor.response?.status()).toBe(200);
  expect(await clinicVisitor.page.content()).toContain(clinic.greeting);
  expect((await startVisitorSession(clinicVisitor.page, newKey)).status).toBe(200);
  expect((await startVisitorSession(clinicVisitor.page, clinic.widgetKey)).status).toBe(401);
  await clinicVisitor.context.close();

  const shopVisitor = await openWidget(browser, shop);
  expect((await startVisitorSession(shopVisitor.page, shop.widgetKey)).status).toBe(200);
  await shopVisitor.context.close();

  // Read before any other shop admin call, which would re-pin the demo key.
  const shopSettings = await owner(shop).request.get("/api/settings/widget");
  expect((await shopSettings.json()).widgetPublicKey).toBe(shop.widgetKey);

  // The bypass sign-in pins each server's DEMO_WIDGET_KEY again on the next
  // owner request, so the old key comes back and the rotated one stops working.
  const clinicSettings = await owner(clinic).request.get("/api/settings/widget");
  expect((await clinicSettings.json()).widgetPublicKey).toBe(clinic.widgetKey);
  const after = await openWidget(browser, clinic);
  expect((await startVisitorSession(after.page, newKey)).status).toBe(401);
  expect((await startVisitorSession(after.page, clinic.widgetKey)).status).toBe(200);
  await after.context.close();
});

test("a made-up widget key gets 401, and its embed page is not found", async ({ browser }) => {
  for (const client of clients) {
    const { context, page, response } = await openWidget(browser, client, BOGUS_WIDGET_KEY);
    expect(response?.status()).toBe(404);

    const session = await page.request.post("/api/widget/session", {
      headers: { "x-widget-key": BOGUS_WIDGET_KEY, Origin: client.baseURL },
      data: {},
    });
    expect(session.status()).toBe(401);

    const chat = await page.request.post("/api/widget/chat/stream", {
      headers: { "x-widget-key": BOGUS_WIDGET_KEY, Origin: client.baseURL },
      data: { message: COVERED_QUESTION },
    });
    expect(chat.status()).toBe(401);
    await context.close();
  }
});
