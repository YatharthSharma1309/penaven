import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => import("./helpers/broken-db"));

import { GET as listConversations } from "@/app/api/conversations/route";
import { GET as listJobs } from "@/app/api/recruitment/jobs/route";
import { POST as widgetStream } from "@/app/api/widget/chat/stream/route";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { clientFor, FAKE_PASSWORD, refusedPool } from "./helpers/broken-db";
import { jsonRequest, readResponse } from "./helpers/http";
import { actAs } from "./helpers/session";

/**
 * What a real database failure looks like through @prisma/adapter-pg, measured
 * here rather than assumed. A refused connection arrives as a
 * PrismaClientKnownRequestError (P1001), so `mapHandlerError` in
 * src/lib/auth/api.ts turns an outage into 409 "A database constraint was
 * violated". A pool timeout or a killed transaction is a plain Error, which gets 500.
 *
 * The route tests below accept that 409 for now. The error-mapping branch should
 * cut this list down to the status it picks.
 */
const ALLOWED_OUTAGE_STATUSES = [409, 500, 503];

type KnownError = InstanceType<typeof Prisma.PrismaClientKnownRequestError>;

function realDatabasePool(options: { max?: number; connectionTimeoutMillis?: number } = {}) {
  return new Pool({ connectionString: process.env.DATABASE_URL, ...options });
}

async function failure(call: () => Promise<unknown>) {
  const error = await call().then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  return error as Error;
}

function expectKnownError(error: Error, code: string) {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as KnownError).code).toBe(code);
}

function adapterCause(error: Error) {
  const { meta } = error as KnownError;
  return (meta?.driverAdapterError as { cause?: Record<string, unknown> })?.cause;
}

describe("the error shape from @prisma/adapter-pg", () => {
  const clients: PrismaClient[] = [];

  function track(client: PrismaClient) {
    clients.push(client);
    return client;
  }

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  it("reports a refused connection as a known error, code P1001", async () => {
    const client = track(clientFor(await refusedPool()));
    const error = await failure(() => client.organization.findFirst());

    expectKnownError(error, "P1001");
    expect(adapterCause(error)?.kind).toBe("DatabaseNotReachable");
    expect(error.message).not.toContain(FAKE_PASSWORD);
  });

  it("reports the same inside a transaction", async () => {
    const client = track(clientFor(await refusedPool()));
    const error = await failure(() =>
      client.$transaction((tx) => tx.organization.findFirst()),
    );

    expectKnownError(error, "P1001");
  });

  it("reports a missing database as a known error, code P1003", async () => {
    const url = new URL(process.env.DATABASE_URL as string);
    url.pathname = "/penaven_no_such_database";
    const client = track(clientFor(new Pool({ connectionString: url.toString() })));
    const error = await failure(() => client.organization.findFirst());

    expectKnownError(error, "P1003");
  });

  it("reports a connection killed by a raw query as a known error, code P2010", async () => {
    const client = track(clientFor(realDatabasePool({ max: 1 })));
    const error = await failure(
      () => client.$queryRaw`SELECT pg_terminate_backend(pg_backend_pid())`,
    );

    expectKnownError(error, "P2010");
    expect(adapterCause(error)?.originalCode).toBe("57P01");
  });

  it("reports a connection killed during a transaction as a plain Error", async () => {
    const client = track(clientFor(realDatabasePool({ max: 2 })));
    const killer = realDatabasePool({ max: 1 });

    const error = await failure(() =>
      client.$transaction(async (tx) => {
        const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
        await killer.query("SELECT pg_terminate_backend($1)", [pid]);
        await new Promise((resolve) => setTimeout(resolve, 100));
        return tx.organization.findFirst();
      }),
    );
    await killer.end();

    expect(error).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error.message).toMatch(/connection/i);
  });

  it("reports a pool wait timeout as a plain Error, not a known error", async () => {
    const pool = realDatabasePool({ max: 1, connectionTimeoutMillis: 200 });
    const held = await pool.connect();
    const client = track(clientFor(pool));

    const error = await failure(() => client.organization.findFirst());
    held.release();

    expect(error).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error.message).toMatch(/timeout/i);
  });
});

describe("a route when the database is down", () => {
  beforeEach(() => {
    actAs({
      userId: "user_canary_outage",
      email: "outage@canary.example.test",
      orgId: "org_canary_outage",
      orgRole: "org:admin",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function expectSafeOutage(status: number, text: string) {
    expect(ALLOWED_OUTAGE_STATUSES).toContain(status);
    expect(text).not.toContain(FAKE_PASSWORD);
    expect(text).not.toMatch(/127\.0\.0\.1|P1001|prisma/i);
  }

  it("keeps connection details out of a support route", async () => {
    const { status, text } = await readResponse(await listConversations());
    expectSafeOutage(status, text);
  });

  it("keeps connection details out of a hiring route", async () => {
    const { status, text } = await readResponse(await listJobs());
    expectSafeOutage(status, text);
  });

  it("keeps connection details out of the widget stream", async () => {
    const { status, text } = await readResponse(
      await widgetStream(
        jsonRequest(
          "POST",
          "/api/widget/chat/stream",
          { message: "Hello" },
          { "x-widget-key": "wk_test_outage", origin: "http://localhost:3000" },
        ),
      ),
    );
    expectSafeOutage(status, text);
  });
});
