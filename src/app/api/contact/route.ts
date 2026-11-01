import { NextResponse } from "next/server";
import { parseJsonBodyLimited } from "@/lib/api/json";
import {
  CONTACT_GLOBAL_HOURLY_CAP,
  CONTACT_MAX_BODY_BYTES,
  CONTACT_RATE_LIMIT,
  CONTACT_RATE_LIMIT_NO_IP,
  isHoneypotFilled,
  validateContact,
} from "@/lib/contact/validation";
import { db } from "@/lib/db";
import { checkRateLimit, getTrustedClientIp } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const TOO_MANY = "Too many messages from this network. Please try again in an hour.";
const SAVE_FAILED =
  "We couldn't save your message right now. Please try again in a few minutes.";

/** The reply for a real save and a honeypot hit, so a bot cannot tell them apart. */
function accepted() {
  return NextResponse.json({ ok: true }, { status: 201 });
}

function hostOf(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).host;
  } catch {
    return null;
  }
}

/**
 * Blocks posts that a browser made from another site. Requests with no Origin
 * and no Sec-Fetch-Site (curl, server-to-server) are allowed.
 */
function isCrossSite(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  const originHost = hostOf(origin);
  if (!originHost) return true; // includes "null"

  const allowed = new Set(
    [
      hostOf(request.url),
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      hostOf(process.env.APP_URL),
    ].filter(Boolean),
  );
  return !allowed.has(originHost);
}

function isJson(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  return type.split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * Public contact form. Stores the message only: no email is sent and no
 * outside service is called. The message body is never logged.
 */
export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (!isJson(request)) {
    return NextResponse.json({ error: "Send the message as application/json." }, { status: 415 });
  }

  const ip = getTrustedClientIp(request);
  const bucket = ip
    ? { key: `contact:${ip}`, ...CONTACT_RATE_LIMIT }
    : { key: "contact:no-ip", ...CONTACT_RATE_LIMIT_NO_IP };
  if (await checkRateLimit(bucket.key, bucket.limit, bucket.windowMs)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const parsed = await parseJsonBodyLimited<Record<string, unknown>>(
    request,
    CONTACT_MAX_BODY_BYTES,
  );
  if ("error" in parsed) return parsed.error;

  // Bots that fill the hidden field get the normal success reply, and nothing is stored.
  if (isHoneypotFilled(parsed.data)) return accepted();

  const result = validateContact(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Check the highlighted fields.", fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  const { name, email, company, teamSize, topic, message } = result.data;

  try {
    const storedLastHour = await db.contactMessage.count({
      where: { createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
    });
    if (storedLastHour >= CONTACT_GLOBAL_HOURLY_CAP) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429 });
    }

    await db.contactMessage.create({
      data: {
        name,
        email,
        company: company ?? null,
        teamSize: teamSize ?? null,
        topic: topic === "general" ? "GENERAL" : "ENTERPRISE",
        message,
      },
    });
  } catch (error) {
    // Prisma errors can echo the query arguments, so log only the kind of failure.
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    console.error("Contact message could not be saved", {
      name: error instanceof Error ? error.name : "UnknownError",
      code,
    });
    return NextResponse.json({ error: SAVE_FAILED }, { status: 503 });
  }

  return accepted();
}
