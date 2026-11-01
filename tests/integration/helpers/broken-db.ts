import { createServer } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

export const FAKE_PASSWORD = "not-a-real-password";

/** A local port with nothing listening on it, so every connection is refused. */
async function closedPort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export function clientFor(pool: Pool) {
  pool.on("error", () => {});
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function refusedPool() {
  return new Pool({
    connectionString: `postgresql://postgres:${FAKE_PASSWORD}@127.0.0.1:${await closedPort()}/nothing`,
  });
}

/** Stands in for `db` from src/lib/db.ts when a test needs the database to be down. */
export const db = clientFor(await refusedPool());
