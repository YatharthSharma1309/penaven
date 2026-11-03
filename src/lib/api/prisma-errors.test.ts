import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isUniqueConstraintError,
  mapPrismaError,
  prismaErrorResponse,
} from "@/lib/api/prisma-errors";

const SECRET = "customer-secret@example.test";
const clientVersion = "7.8.0";

function known(code: string, meta: Record<string, unknown> = { modelName: "Ticket" }) {
  return new Prisma.PrismaClientKnownRequestError(
    `Invalid call with value ${SECRET}`,
    { code, clientVersion, meta },
  );
}

function driverMeta(cause: Record<string, unknown>) {
  return { driverAdapterError: { name: "DriverAdapterError", cause } };
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapPrismaError codes", () => {
  it.each([
    ["P1001", 503],
    ["P1002", 503],
    ["P1008", 503],
    ["P1017", 503],
    ["P2024", 503],
    ["P2028", 503],
    ["P2037", 503],
    ["P2025", 404],
    ["P2002", 409],
    ["P2003", 409],
    ["P2034", 409],
    ["P2000", 400],
    ["P2006", 400],
    ["P2007", 400],
    ["P2009", 400],
    ["P2011", 400],
    ["P2012", 400],
    ["P2019", 400],
    ["P2020", 400],
    ["P2023", 400],
    ["P2021", 500],
    ["P2022", 500],
    ["P2010", 500],
    ["P2999", 500],
    ["P1000", 500],
  ])("%s gives %i", (code, status) => {
    const mapped = mapPrismaError(known(code));

    expect(mapped?.status).toBe(status);
    expect(mapped?.code).toBe(code);
    expect(mapped?.model).toBe("Ticket");
    expect(mapped?.retryAfterSeconds === null).toBe(status !== 503);
    expect(mapped?.message).not.toContain(SECRET);
    expect(mapped?.message).not.toMatch(/prisma|P\d{4}/i);
  });
});

describe("mapPrismaError other Prisma errors", () => {
  it("gives 503 for an initialization error", () => {
    const error = new Prisma.PrismaClientInitializationError(
      `Cannot start with ${SECRET}`,
      clientVersion,
      "P1001",
    );
    expect(mapPrismaError(error)).toMatchObject({ status: 503, code: "P1001" });
  });

  it("gives 503 for an initialization error with no code", () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Cannot start",
      clientVersion,
    );
    expect(mapPrismaError(error)).toMatchObject({
      status: 503,
      code: "INITIALIZATION",
    });
  });

  it.each([
    [
      "unknown request",
      new Prisma.PrismaClientUnknownRequestError(SECRET, { clientVersion }),
      "UNKNOWN_REQUEST",
    ],
    [
      "validation",
      new Prisma.PrismaClientValidationError(SECRET, { clientVersion }),
      "VALIDATION",
    ],
    ["panic", new Prisma.PrismaClientRustPanicError(SECRET, clientVersion), "PANIC"],
  ])("gives 500 for a %s error", (_label, error, code) => {
    expect(mapPrismaError(error)).toMatchObject({ status: 500, code });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  });
});

describe("mapPrismaError connection shapes seen on a real server", () => {
  it("finds an outage hidden under P2010 on a raw query", () => {
    const error = known(
      "P2010",
      driverMeta({ kind: "DatabaseNotReachable", host: "127.0.0.1", port: 5432 }),
    );
    expect(mapPrismaError(error)).toMatchObject({ status: 503, code: "P2010" });
  });

  it("finds too many connections under P2010", () => {
    const error = known(
      "P2010",
      driverMeta({ kind: "TooManyConnections", originalCode: "53300" }),
    );
    expect(mapPrismaError(error)?.status).toBe(503);
  });

  it("finds a server shutdown under P2010", () => {
    const error = known(
      "P2010",
      driverMeta({ kind: "postgres", code: "57P01", originalCode: "57P01" }),
    );
    expect(mapPrismaError(error)?.status).toBe(503);
  });

  it("keeps P2010 at 500 when the driver cause is not a connection failure", () => {
    const error = known(
      "P2010",
      driverMeta({ kind: "postgres", code: "42601", originalCode: "42601" }),
    );
    expect(mapPrismaError(error)?.status).toBe(500);
  });

  it("handles a known error whose code is a socket code", () => {
    const error = known("ECONNREFUSED", { modelName: "User" });
    expect(mapPrismaError(error)).toMatchObject({
      status: 503,
      code: "ECONNREFUSED",
      model: "User",
    });
  });

  it("handles a bare DriverAdapterError from a killed backend", () => {
    const error = Object.assign(new Error("terminating connection"), {
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "57P01", originalCode: "57P01" },
    });
    expect(mapPrismaError(error)).toMatchObject({ status: 503, code: "57P01" });
  });

  it("gives 500 for a bare DriverAdapterError that is not a connection failure", () => {
    const error = Object.assign(new Error(`bad value ${SECRET}`), {
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "22021", originalCode: "22021" },
    });
    expect(mapPrismaError(error)).toMatchObject({ status: 500, code: "22021" });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  });

  it.each(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "57P01", "08006"])(
    "treats a plain error with code %s as an outage",
    (code) => {
      const error = Object.assign(new Error("connect failed"), { code });
      expect(mapPrismaError(error)).toMatchObject({ status: 503, code });
    },
  );

  it.each([
    "timeout exceeded when trying to connect",
    "Connection terminated due to connection timeout",
    "Connection terminated unexpectedly",
    "Connection terminated",
    "Client has encountered a connection error and is not queryable",
    "Client was closed and is not queryable",
  ])("treats the codeless pg error %j as an outage", (message) => {
    expect(mapPrismaError(new Error(message))).toMatchObject({
      status: 503,
      code: "PG_CONNECTION",
      model: null,
    });
  });
});

describe("mapPrismaError leaves other errors alone", () => {
  it.each([
    ["a plain error", new Error("Something else")],
    ["a message that only mentions a timeout", new Error("timeout while parsing")],
    ["a plain error with another code", Object.assign(new Error("x"), { code: "ENOENT" })],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("returns null for %s", (_label, error) => {
    expect(mapPrismaError(error)).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe("mapped error logging", () => {
  it("logs the code and model and nothing from the error", () => {
    const error = known("P2002", {
      modelName: "User",
      target: [SECRET],
      driverAdapterError: { cause: { originalMessage: SECRET } },
    });

    mapPrismaError(error);

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith("Database error", {
      code: "P2002",
      model: "User",
      status: 409,
    });
  });

  it("does not trust a model name that is not an identifier", () => {
    expect(mapPrismaError(known("P2002", { modelName: SECRET }))?.model).toBeNull();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
  });
});

describe("prismaErrorResponse", () => {
  it("sends Retry-After on a 503", async () => {
    const response = prismaErrorResponse(known("P1001"));

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Retry-After")).toBe("5");
    expect(await response?.json()).toEqual({
      error: "The service is temporarily unavailable. Please try again shortly.",
    });
  });

  it("leaves Retry-After off other statuses and keeps extra fields", async () => {
    const response = prismaErrorResponse(known("P2025"), { conversationId: "c1" });

    expect(response?.status).toBe(404);
    expect(response?.headers.get("Retry-After")).toBeNull();
    expect(await response?.json()).toEqual({
      error: "That record was not found.",
      conversationId: "c1",
    });
  });

  it("returns null for an error that is not a database failure", () => {
    expect(prismaErrorResponse(new Error("Something else"))).toBeNull();
  });
});

describe("isUniqueConstraintError", () => {
  it("is true only for P2002 and stays quiet", () => {
    expect(isUniqueConstraintError(known("P2002"))).toBe(true);
    expect(isUniqueConstraintError(known("P2025"))).toBe(false);
    expect(isUniqueConstraintError(new Error("P2002"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(errorLog).not.toHaveBeenCalled();
  });
});
