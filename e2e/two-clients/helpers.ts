import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Client } from "./clients";

export type SseEvent = { event: string; data: Record<string, unknown> };

export type ChatSource = { documentTitle?: string; content: string };

export type WidgetTurn = {
  status: number;
  events: SseEvent[];
  meta: {
    conversationId?: string;
    sources?: ChatSource[];
    chunksMatched?: number;
  };
  done: boolean;
};

export function parseSse(text: string): SseEvent[] {
  return text
    .split("\n\n")
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = block.match(/^data: (.+)$/m)?.[1];
      if (!event || !data) return null;
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    })
    .filter((item): item is SseEvent => item !== null);
}

/** An owner's browser. The server is pinned to this client's workspace. */
export async function ownerContext(browser: Browser, client: Client) {
  return browser.newContext({ baseURL: client.baseURL });
}

/** A visitor with no session of any kind, on the client's widget page. */
export async function openWidget(browser: Browser, client: Client, key = client.widgetKey) {
  const context = await browser.newContext({ baseURL: client.baseURL });
  const page = await context.newPage();
  const response = await page.goto(`/widget/embed?key=${encodeURIComponent(key)}`);
  return { context, page, response };
}

/**
 * Talks to the widget API from inside the embed page, so the request carries
 * the page's own Origin, as the widget does. Asserts nothing about wording.
 */
export async function startVisitorSession(page: Page, widgetKey: string) {
  return page.evaluate(async (key) => {
    const response = await fetch("/api/widget/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-widget-key": key },
      body: JSON.stringify({}),
    });
    return {
      status: response.status,
      body: (await response.json()) as { visitorId?: string; visitorToken?: string },
    };
  }, widgetKey);
}

export async function askWidget(
  page: Page,
  input: {
    widgetKey: string;
    visitorId: string;
    visitorToken: string;
    message: string;
    conversationId?: string;
  },
): Promise<WidgetTurn> {
  const { status, text } = await page.evaluate(async (body) => {
    const { widgetKey, ...payload } = body;
    const response = await fetch("/api/widget/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-widget-key": widgetKey },
      body: JSON.stringify(payload),
    });
    return { status: response.status, text: await response.text() };
  }, input);

  const events = status === 200 ? parseSse(text) : [];
  const meta = (events.find((item) => item.event === "meta")?.data ?? {}) as WidgetTurn["meta"];
  return {
    status,
    events,
    meta,
    done: events.some((item) => item.event === "done"),
  };
}

export async function handOff(
  page: Page,
  input: {
    widgetKey: string;
    visitorId: string;
    visitorToken: string;
    conversationId: string;
    question: string;
    email: string;
  },
) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/widget/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-widget-key": body.widgetKey },
      body: JSON.stringify({
        title: `Escalation: ${body.question}`,
        description: `Visitor asked: ${body.question}`,
        conversationId: body.conversationId,
        requesterEmail: body.email,
        visitorId: body.visitorId,
        visitorToken: body.visitorToken,
      }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { ticket?: { id: string; requesterEmail?: string | null } },
    };
  }, input);
}

/** The app's not-found page, whatever status the streamed response ended with. */
export async function expectNotFoundPage(page: Page, path: string) {
  const response = await page.goto(path);
  const status = response?.status() ?? 0;
  if (status !== 404) {
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
  return status;
}

/** Hrefs of every link on the page, for checking which records a list shows. */
export async function linkHrefs(page: Page) {
  return page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );
}

export async function closeAll(contexts: Array<BrowserContext | undefined>) {
  await Promise.all(contexts.map((context) => context?.close()));
}
