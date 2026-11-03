import { describe, expect, it } from "vitest";
import {
  BYPASS_ENV_VARS,
  assertIntegrationEnv,
  assertTwoClientsEnv,
  integrationEnvProblems,
  twoClientsEnvProblems,
} from "./env-guard";

const SAFE = "postgresql://postgres@127.0.0.1:5432/test?sslmode=disable";

describe("integration environment guard", () => {
  it.each([
    SAFE,
    "postgres://postgres:postgres@localhost:5432/supportai_test?sslmode=disable",
  ])("allows %s", (url) => {
    expect(integrationEnvProblems({ DATABASE_URL: url })).toEqual([]);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not a URL", "localhost"],
    ["another scheme", "mysql://root@localhost/test"],
    ["a remote host", "postgresql://user:pw@db.example.com/test"],
    ["a host that starts with localhost", "postgresql://user@localhost.example.com/test"],
    ["a remote host after a local one", "postgresql://user@localhost,db.example.com/test"],
    ["a local user on a remote host", "postgresql://localhost:pw@db.example.com/test"],
    ["a host in the query string", "postgresql://user@localhost/test?host=db.example.com"],
    ["an address in the query string", "postgresql://user@localhost/test?hostaddr=10.0.0.1"],
    ["the IPv4 wildcard", "postgresql://user@0.0.0.0/test"],
  ])("refuses %s", (_name, url) => {
    expect(() => assertIntegrationEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
  });

  it.each(BYPASS_ENV_VARS)("refuses %s even on localhost", (name) => {
    expect(() => assertIntegrationEnv({ DATABASE_URL: SAFE, [name]: "true" })).toThrow(name);
  });

  it("refuses a production NODE_ENV", () => {
    expect(() =>
      assertIntegrationEnv({ DATABASE_URL: SAFE, NODE_ENV: "production" }),
    ).toThrow("NODE_ENV");
  });
});

describe("two-client suite environment guard", () => {
  it("allows a local database with the sign-in bypass set", () => {
    expect(
      twoClientsEnvProblems({ DATABASE_URL: SAFE, AUTH_BYPASS: "true" }),
    ).toEqual([]);
  });

  it.each([
    ["a remote host", "postgresql://user:pw@db.example.com/test"],
    ["a host in the query string", "postgresql://user@localhost/test?host=db.example.com"],
    ["missing", undefined],
  ])("refuses %s", (_name, url) => {
    expect(() => assertTwoClientsEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
  });

  it.each(["PUBLIC_DEMO_MODE", "NEXT_PUBLIC_PUBLIC_DEMO_MODE"])(
    "refuses %s",
    (name) => {
      expect(() => assertTwoClientsEnv({ DATABASE_URL: SAFE, [name]: "true" })).toThrow(name);
    },
  );

  it("refuses a production NODE_ENV", () => {
    expect(() =>
      assertTwoClientsEnv({ DATABASE_URL: SAFE, NODE_ENV: "production" }),
    ).toThrow("NODE_ENV");
  });
});
