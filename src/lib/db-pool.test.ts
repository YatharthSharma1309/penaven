import { describe, expect, it, vi } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: class {} }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));

process.env.DATABASE_URL ??= "postgres://u:p@db.example.com:5432/app";
const { poolSizeFor } = await import("@/lib/db");

describe("poolSizeFor", () => {
  it("uses one connection for the local PGlite server", () => {
    expect(poolSizeFor("postgres://postgres:pw@127.0.0.1:5433/postgres", {})).toBe(1);
    expect(poolSizeFor("postgresql://postgres:pw@localhost:5433/postgres", {})).toBe(1);
  });

  it("keeps pg's default for hosted or other local Postgres", () => {
    expect(poolSizeFor("postgres://u:p@ep-x.neon.tech/db?sslmode=require", {})).toBeUndefined();
    expect(poolSizeFor("postgres://u:p@127.0.0.1:5441/postgres", {})).toBeUndefined();
  });

  it("lets DATABASE_POOL_MAX override", () => {
    expect(poolSizeFor("postgres://u:p@127.0.0.1:5433/postgres", { DATABASE_POOL_MAX: "4" })).toBe(4);
    expect(poolSizeFor("postgres://u:p@ep-x.neon.tech/db", { DATABASE_POOL_MAX: "3" })).toBe(3);
    expect(poolSizeFor("postgres://u:p@127.0.0.1:5433/postgres", { DATABASE_POOL_MAX: "x" })).toBe(1);
  });
});
