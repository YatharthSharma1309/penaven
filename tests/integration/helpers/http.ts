import { expect } from "vitest";
import { createVisitorToken } from "@/lib/auth/widget-visitor";
import { db } from "@/lib/db";
import { CANARY_PREFIX, snapshotTenant, type Tenant } from "./seed";

export type RouteContext = { params: Promise<{ id: string }> };

export function idContext(id: string): RouteContext {
  return { params: Promise.resolve({ id }) };
}

export function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function formRequest(path: string, form: FormData) {
  return new Request(`http://localhost:3000${path}`, { method: "POST", body: form });
}

export function widgetHeaders(tenant: Tenant) {
  return { "x-widget-key": tenant.widgetKey, origin: tenant.origin };
}

/** The visitor fields a widget page sends after `/api/widget/session`. */
export function visitorFields(tenant: Tenant, visitorId = tenant.visitorId) {
  return {
    visitorId,
    visitorToken: createVisitorToken(tenant.organization.id, visitorId),
  };
}

/** Status, headers and body as text. Reading the body also drains a stream. */
export async function readResponse(response: Response) {
  const body = Buffer.from(await response.arrayBuffer()).toString("utf8");
  const headers = JSON.stringify(Object.fromEntries(response.headers));
  return { status: response.status, text: `${headers}\n${body}`, body };
}

export function canaryOf(tenant: Tenant) {
  return new RegExp(`${CANARY_PREFIX}-${tenant.label}-`, "i");
}

export function expectNothingFrom(tenant: Tenant, text: string) {
  expect(text).not.toMatch(canaryOf(tenant));

  // These belong to the workspace but carry no canary.
  for (const secret of [
    tenant.widgetKey,
    tenant.origin,
    tenant.organization.slug,
    tenant.user.email,
    tenant.ticket.requesterEmail as string,
  ]) {
    expect(text).not.toContain(secret);
  }
}

/**
 * Runs `call` and checks what a denial has to mean: the status, no byte of the
 * victim's data in the response, no change to the victim's rows, and no audit
 * row in another workspace naming the victim's records.
 */
export async function expectDenied(
  victim: Tenant,
  expectedStatus: 400 | 401 | 404,
  call: () => Promise<Response>,
) {
  const before = await snapshotTenant(victim);
  const { status, text } = await readResponse(await call());

  expect(status).toBe(expectedStatus);
  expectNothingFrom(victim, text);
  expect(await snapshotTenant(victim)).toEqual(before);

  const foreignAuditRows = await db.recruitmentAuditEvent.count({
    where: {
      organizationId: { not: victim.organization.id },
      entityId: {
        in: [victim.job.id, victim.candidate.id, victim.hired.id, victim.archived.id],
      },
    },
  });
  expect(foreignAuditRows).toBe(0);
}
