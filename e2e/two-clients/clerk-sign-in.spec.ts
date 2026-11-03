import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLERK_PORT, CLIENTS, type ClientId } from "./clients";
import {
  CLERK_TEST_USERS,
  findOrCreateOrganization,
  findOrCreateUser,
  organizationsDisabledReason,
} from "./clerk";

/**
 * The real Clerk sign-in, against a server with no bypass. Opt in with
 * TWO_CLIENTS_CLERK=1 and the test instance's keys (CLERK_SECRET_KEY and
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, or a `.env.local` that has them).
 *
 * A workspace is a Clerk organization. When the instance has organizations
 * turned off, the second test is skipped with Clerk's own reason, and the
 * two-client walkthrough runs on the bypass sign-in instead.
 */
const enabled = process.env.TWO_CLIENTS_CLERK === "1";
const baseURL = `http://localhost:${CLERK_PORT}`;
const ids: ClientId[] = ["clinic", "shop"];

let orgsOffReason: string | null = null;
const userIds: Partial<Record<ClientId, string>> = {};
const orgIds: Partial<Record<ClientId, string>> = {};

test.describe("real Clerk sign-in", () => {
  // A dev server compiles each route on its first request.
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.skip(!enabled, "Set TWO_CLIENTS_CLERK=1 with Clerk test keys to run the real sign-in.");

  test.beforeAll(async () => {
    for (const id of ids) {
      userIds[id] = (await findOrCreateUser(id)).id;
    }
    orgsOffReason = await organizationsDisabledReason();
    if (!orgsOffReason) {
      for (const id of ids) {
        orgIds[id] = (await findOrCreateOrganization(id, userIds[id]!)).id;
      }
    }
  });

  /** From the page, so the call carries the browser's Clerk session as the app's own fetches do. */
  async function browserFetch(page: Page, path: string, method = "GET") {
    return page.evaluate(
      async ({ path, method }) => {
        const response = await fetch(path, { method });
        const text = await response.text();
        return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
      },
      { path, method },
    );
  }

  async function signIn(page: Page, id: ClientId) {
    await page.goto(`${baseURL}/sign-in`);
    await clerk.signIn({ page, emailAddress: CLERK_TEST_USERS[id].email });
    const email = await page.evaluate(
      () => (window as unknown as { Clerk: { user?: { primaryEmailAddress?: { emailAddress: string } } } })
        .Clerk.user?.primaryEmailAddress?.emailAddress,
    );
    expect(email).toBe(CLERK_TEST_USERS[id].email);
  }

  test("each test owner signs in, and with no organization stops at the workspace gate", async ({
    browser,
  }) => {
    for (const id of ids) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, id);

      if (orgsOffReason) {
        await page.goto(`${baseURL}/dashboard`);
        await expect(page).toHaveURL(/\/onboarding/);
        expect((await browserFetch(page, "/api/documents")).status).toBe(401);
      }
      await context.close();
    }
  });

  test("two Clerk organizations get separate workspaces", async ({ browser }) => {
    test.skip(Boolean(orgsOffReason), `Clerk organizations are off in this instance (${orgsOffReason}).`);

    const seen: Record<string, { slug: string; documentId: string }> = {};
    const contexts = [];
    for (const id of ids) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await signIn(page, id);
      await page.evaluate(
        (organization) =>
          (window as unknown as { Clerk: { setActive(params: { organization: string }): Promise<void> } })
            .Clerk.setActive({ organization }),
        orgIds[id]!,
      );
      await page.goto(`${baseURL}/dashboard`);
      await expect(page).toHaveURL(/\/dashboard$/);

      const widget = await browserFetch(page, "/api/settings/widget");
      expect(widget.status).toBe(200);
      const upload = await page.evaluate(async (faq) => {
        const form = new FormData();
        form.append("file", new File([faq.body], faq.fileName, { type: "text/markdown" }));
        const response = await fetch("/api/documents/upload", { method: "POST", body: form });
        return { status: response.status, body: await response.json() };
      }, CLIENTS[id].faq);
      expect(upload.status).toBe(200);
      seen[id] = {
        slug: (widget.body as { slug: string }).slug,
        documentId: (upload.body as { document: { id: string } }).document.id,
      };
    }

    expect(seen.clinic.slug).not.toBe(seen.shop.slug);

    // The shop owner cannot delete the clinic's document, and does not see it.
    const shopPage = contexts[1].pages()[0];
    const probe = await browserFetch(shopPage, `/api/documents/${seen.clinic.documentId}`, "DELETE");
    expect(probe.status).toBe(404);
    const shopDocs = await browserFetch(shopPage, "/api/documents");
    const listed = (shopDocs.body as { documents: Array<{ id: string }> }).documents.map((doc) => doc.id);
    expect(listed).toContain(seen.shop.documentId);
    expect(listed).not.toContain(seen.clinic.documentId);

    // Each run starts from the same empty workspaces.
    for (const [index, id] of ids.entries()) {
      await browserFetch(contexts[index].pages()[0], `/api/documents/${seen[id].documentId}`, "DELETE");
    }
    await Promise.all(contexts.map((context) => context.close()));
  });
});
