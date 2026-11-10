import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when the cached Prisma client or pg pool must be rebuilt. */
const PRISMA_CLIENT_GENERATION = "local-pool-size-v1";

const LEGACY_PG_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * pg aliases prefer, require, and verify-ca to verify-full and warns.
 * Rewrite only those query values. String ops avoid re-encoding passwords.
 */
export function normalizeDatabaseSslMode(connectionString: string): string {
  const queryStart = connectionString.indexOf("?");
  if (queryStart === -1) {
    return connectionString;
  }

  const parts = connectionString.slice(queryStart + 1).split("&");
  let changed = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const eq = part.indexOf("=");
    if (eq === -1) continue;

    if (part.slice(0, eq).toLowerCase() !== "sslmode") continue;

    const mode = part.slice(eq + 1).toLowerCase();
    if (!LEGACY_PG_SSL_MODES.has(mode)) continue;

    parts[i] = "sslmode=verify-full";
    changed = true;
  }

  if (!changed) {
    return connectionString;
  }

  return connectionString.slice(0, queryStart + 1) + parts.join("&");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  prismaGeneration?: string;
};

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and run `npx prisma dev`, then paste the postgres:// URL.",
    );
  }

  if (url.startsWith("prisma+postgres://")) {
    throw new Error(
      "DATABASE_URL uses prisma+postgres:// which is not supported by the pg driver. Run `npx prisma dev` and use the direct postgres:// URL it prints.",
    );
  }

  return normalizeDatabaseSslMode(url);
}

/**
 * The local PGlite server (`npm run db:local`, port 5433) runs one database and
 * mixes up queries sent on several connections at once ("portal does not exist",
 * "unnamed prepared statement does not exist", then a stuck server). Use one
 * connection there. DATABASE_POOL_MAX overrides; hosted Postgres keeps pg's default.
 */
export function poolSizeFor(
  connectionString: string,
  env: Record<string, string | undefined> = process.env,
): number | undefined {
  const override = Number.parseInt(env.DATABASE_POOL_MAX ?? "", 10);
  if (Number.isInteger(override) && override > 0) return override;

  try {
    const { hostname, port } = new URL(connectionString);
    const local = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    if (local && port === "5433") return 1;
  } catch {
    // Not a URL pg can parse either; let pg report it.
  }
  return undefined;
}

function createPrismaClient() {
  const connectionString = resolveDatabaseUrl();
  const max = poolSizeFor(connectionString);
  const pool =
    globalForPrisma.pool ??
    new Pool({
      connectionString,
      ...(max
        ? // With one connection, a query waiting behind a long one fails instead of hanging.
          { max, connectionTimeoutMillis: 10_000 }
        : {}),
    });

  const adapter = new PrismaPg(pool, { schema: "public" });
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = client;
    globalForPrisma.prismaGeneration = PRISMA_CLIENT_GENERATION;
  }

  return client;
}

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaGeneration !== PRISMA_CLIENT_GENERATION
) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pool = undefined;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();
