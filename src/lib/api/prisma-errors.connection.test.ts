import net from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { mapPrismaError } from "@/lib/api/prisma-errors";

/**
 * No mocks and no database: the real client, adapter, and pg pool fail against
 * sockets opened here, so a Prisma upgrade that changes a shape breaks this.
 */

function listen(onConnection: (socket: net.Socket) => void) {
  return new Promise<net.Server>((resolve, reject) => {
    const server = net.createServer(onConnection);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function portOf(server: net.Server) {
  return (server.address() as net.AddressInfo).port;
}

async function closedPort() {
  const server = await listen(() => {});
  const port = portOf(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function clientFor(host: string, port: number) {
  const pool = new Pool({
    connectionString: `postgresql://probe@${host}:${port}/probe`,
    connectionTimeoutMillis: 500,
  });
  pool.on("error", () => {});
  return { pool, db: new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) }) };
}

async function failure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to fail.");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a closed port", () => {
  let port: number;
  let client: ReturnType<typeof clientFor>;

  beforeAll(async () => {
    port = await closedPort();
    client = clientFor("127.0.0.1", port);
  });

  afterAll(async () => {
    await client.db.$disconnect();
    await client.pool.end();
  });

  it("gives 503 from a model call, reported as P1001", async () => {
    const error = await failure(() => client.db.user.count());
    expect(mapPrismaError(error)).toMatchObject({
      status: 503,
      code: "P1001",
      model: "User",
    });
  });

  it("gives 503 from a raw query, reported as P2010", async () => {
    const error = await failure(() => client.db.$queryRaw`SELECT 1`);
    expect(mapPrismaError(error)).toMatchObject({ status: 503, code: "P2010" });
  });

  it("gives 503 from an interactive transaction", async () => {
    const error = await failure(() =>
      client.db.$transaction((tx) => tx.user.count()),
    );
    expect(mapPrismaError(error)?.status).toBe(503);
  });

  it("gives 503 from a batch transaction", async () => {
    const error = await failure(() =>
      client.db.$transaction([client.db.user.count(), client.db.message.count()]),
    );
    expect(mapPrismaError(error)?.status).toBe(503);
  });

  it("gives 503 from the bare pool, a plain error", async () => {
    const error = await failure(() => client.pool.query("SELECT 1"));
    expect(mapPrismaError(error)).toMatchObject({
      status: 503,
      code: "ECONNREFUSED",
    });
  });

  it("gives 503 through localhost, where the code is not a Prisma code", async () => {
    const local = clientFor("localhost", port);
    try {
      const error = await failure(() => local.db.user.count());
      expect(mapPrismaError(error)).toMatchObject({
        status: 503,
        code: "ECONNREFUSED",
      });
    } finally {
      await local.db.$disconnect();
      await local.pool.end();
    }
  });
});

describe("a server that misbehaves", () => {
  const sockets = new Set<net.Socket>();

  afterEach(() => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
  });

  it("gives 503 when the server drops the connection", async () => {
    const server = await listen((socket) => {
      socket.on("error", () => {});
      socket.destroy();
    });
    const client = clientFor("127.0.0.1", portOf(server));

    try {
      const error = await failure(() => client.pool.query("SELECT 1"));
      expect(mapPrismaError(error)?.status).toBe(503);
    } finally {
      await client.pool.end();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("gives 503 when the server accepts and never answers", async () => {
    const server = await listen((socket) => {
      socket.on("error", () => {});
      sockets.add(socket);
    });
    const client = clientFor("127.0.0.1", portOf(server));

    try {
      const error = await failure(() => client.db.user.count());
      expect(mapPrismaError(error)?.status).toBe(503);
    } finally {
      await client.db.$disconnect();
      await client.pool.end();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
