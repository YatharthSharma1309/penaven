/**
 * Turns database failures into plain API errors. Matches on `name` rather than
 * instanceof, so this file does not load the generated client and survives a
 * bundler duplicating the Prisma runtime.
 *
 * The connection shapes below were captured from Prisma 7 with adapter-pg, on a
 * closed port and on a real server killed mid-query. Prisma does not always
 * report an outage as a P1xxx code.
 */

const RETRY_AFTER_SECONDS = 5;

const MESSAGES = {
  400: "Some of the submitted data is not valid.",
  404: "That record was not found.",
  409: "That change conflicts with existing data. Refresh and try again.",
  500: "Something went wrong on our side. Please try again.",
  503: "The service is temporarily unavailable. Please try again shortly.",
} as const;

export type MappedPrismaStatus = keyof typeof MESSAGES;

export type MappedPrismaError = {
  status: MappedPrismaStatus;
  message: string;
  /** Safe to log: a Prisma, Postgres, or socket code. Never holds field values. */
  code: string;
  model: string | null;
  retryAfterSeconds: number | null;
};

const STATUS_BY_PRISMA_CODE: Record<string, MappedPrismaStatus> = {
  P1001: 503,
  P1002: 503,
  P1008: 503,
  P1017: 503,
  P2024: 503,
  P2028: 503,
  P2037: 503,
  P2025: 404,
  P2002: 409,
  P2003: 409,
  P2034: 409,
  P2000: 400,
  P2006: 400,
  P2007: 400,
  P2009: 400,
  P2011: 400,
  P2012: 400,
  P2019: 400,
  P2020: 400,
  P2023: 400,
};

/** Set by adapter-pg; a raw query keeps these under P2010, not a P1xxx code. */
const CONNECTION_DRIVER_KINDS = new Set([
  "DatabaseNotReachable",
  "ConnectionClosed",
  "SocketTimeout",
  "TooManyConnections",
]);

const CONNECTION_SOCKET_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/** pg throws these without a code. Exact text, so other errors never match. */
const CONNECTION_PG_MESSAGES = new Set([
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
  "Connection terminated unexpectedly",
  "Connection terminated",
  "Client has encountered a connection error and is not queryable",
  "Client was closed and is not queryable",
]);

function isConnectionSqlState(code: unknown) {
  if (typeof code !== "string") return false;
  return (
    code.startsWith("08") ||
    code === "53300" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03"
  );
}

type ErrorShape = {
  name?: unknown;
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  meta?: { modelName?: unknown; driverAdapterError?: { cause?: unknown } };
  cause?: unknown;
};

type DriverCause = { kind?: unknown; code?: unknown; originalCode?: unknown };

function asDriverCause(value: unknown): DriverCause | null {
  return typeof value === "object" && value !== null ? value : null;
}

function isConnectionDriverCause(cause: DriverCause | null) {
  if (!cause) return false;
  return (
    (typeof cause.kind === "string" && CONNECTION_DRIVER_KINDS.has(cause.kind)) ||
    isConnectionSqlState(cause.code) ||
    isConnectionSqlState(cause.originalCode)
  );
}

function safeCode(value: unknown, fallback: string) {
  return typeof value === "string" && /^[A-Za-z0-9_]{1,40}$/.test(value)
    ? value
    : fallback;
}

function safeModel(shape: ErrorShape) {
  const model = shape.meta?.modelName;
  return typeof model === "string" && /^[A-Za-z0-9_]{1,64}$/.test(model)
    ? model
    : null;
}

function build(
  status: MappedPrismaStatus,
  code: string,
  model: string | null,
): MappedPrismaError {
  return {
    status,
    message: MESSAGES[status],
    code,
    model,
    retryAfterSeconds: status === 503 ? RETRY_AFTER_SECONDS : null,
  };
}

function classify(error: unknown): MappedPrismaError | null {
  if (typeof error !== "object" || error === null) return null;

  const shape = error as ErrorShape;
  const model = safeModel(shape);

  switch (shape.name) {
    case "PrismaClientKnownRequestError": {
      const code = safeCode(shape.code, "UNKNOWN");
      const driverCause = asDriverCause(shape.meta?.driverAdapterError?.cause);
      // localhost refusals arrive as this class with code ECONNREFUSED.
      if (
        isConnectionDriverCause(driverCause) ||
        CONNECTION_SOCKET_CODES.has(code)
      ) {
        return build(503, code, model);
      }
      return build(STATUS_BY_PRISMA_CODE[code] ?? 500, code, model);
    }
    case "PrismaClientInitializationError":
      return build(503, safeCode(shape.errorCode, "INITIALIZATION"), model);
    case "PrismaClientUnknownRequestError":
      return build(500, "UNKNOWN_REQUEST", model);
    case "PrismaClientRustPanicError":
      return build(500, "PANIC", model);
    case "PrismaClientValidationError":
      return build(500, "VALIDATION", model);
    case "DriverAdapterError": {
      const cause = asDriverCause(shape.cause);
      const code = safeCode(cause?.originalCode ?? cause?.kind, "DRIVER_ADAPTER");
      return build(isConnectionDriverCause(cause) ? 503 : 500, code, model);
    }
  }

  if (typeof shape.code === "string") {
    if (CONNECTION_SOCKET_CODES.has(shape.code) || isConnectionSqlState(shape.code)) {
      return build(503, safeCode(shape.code, "CONNECTION"), model);
    }
  }

  if (typeof shape.message === "string" && CONNECTION_PG_MESSAGES.has(shape.message)) {
    return build(503, "PG_CONNECTION", model);
  }

  return null;
}

/**
 * Maps a database failure, or returns null so the caller keeps its own handling.
 * Logs each mapped error by code and model only: Prisma messages and meta can
 * quote the values a customer sent.
 */
export function mapPrismaError(error: unknown): MappedPrismaError | null {
  const mapped = classify(error);
  if (mapped) {
    console.error("Database error", {
      code: mapped.code,
      model: mapped.model,
      status: mapped.status,
    });
  }
  return mapped;
}

/** JSON response for a database failure, or null when it is not one. */
export function prismaErrorResponse(
  error: unknown,
  extraBody?: Record<string, unknown>,
) {
  const mapped = mapPrismaError(error);
  if (!mapped) return null;

  const headers: Record<string, string> =
    mapped.retryAfterSeconds === null
      ? {}
      : { "Retry-After": String(mapped.retryAfterSeconds) };

  return Response.json(
    { error: mapped.message, ...extraBody },
    { status: mapped.status, headers },
  );
}

/** A unique constraint clash. Does not log, so callers can recover quietly. */
export function isUniqueConstraintError(error: unknown) {
  const shape = error as ErrorShape | null;
  return shape?.name === "PrismaClientKnownRequestError" && shape.code === "P2002";
}
