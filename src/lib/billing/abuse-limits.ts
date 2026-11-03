import { db } from "@/lib/db";
import {
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  isPublicDemoMode,
} from "@/lib/env/public-demo";
import { checkRateLimit, clientIpBucket } from "@/lib/rate-limit";

/**
 * Safety limits against abuse of public AI routes. These are not plan caps:
 * nothing here is published, and the included answers in plans.ts are unchanged.
 * There is deliberately no daily limit on a real workspace as a whole.
 */
export const SAFETY_ANSWERS_PER_IP_PER_DAY = 20;

/** The shared demo is the one workspace with no monthly cap to stop a run of visitors. */
export const SAFETY_DEMO_ANSWERS_PER_DAY = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

const RATE_LIMITED = "Rate limit exceeded";

export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Counted from Postgres, so it holds across instances without Upstash. Every
 * answered turn stores a USER message, the same row the monthly cap counts.
 */
export async function countAnswersToday(organizationId: string, now = new Date()) {
  return db.message.count({
    where: {
      role: "USER",
      createdAt: { gte: startOfUtcDay(now) },
      conversation: { organizationId },
    },
  });
}

/**
 * True when this answer must not run. Call it last before the model, because
 * it uses up one of the IP's answers, and a 429 here stores no message, so it
 * cannot eat into the monthly cap.
 */
export async function answerSafetyLimitReached(
  request: Request,
  organizationId: string,
  now = new Date(),
) {
  if (
    isPublicDemoMode() &&
    (await countAnswersToday(organizationId, now)) >= SAFETY_DEMO_ANSWERS_PER_DAY
  ) {
    return true;
  }

  const utcDay = startOfUtcDay(now).toISOString().slice(0, 10);
  return checkRateLimit(
    `answers-day:${organizationId}:${clientIpBucket(request)}:${utcDay}`,
    SAFETY_ANSWERS_PER_IP_PER_DAY,
    DAY_MS,
  );
}

/**
 * Admin chat limits apply to the public demo only. A sandbox turn is refused
 * there because it stores no message, so the demo count would never see it.
 * Settings is the only screen that sends one, and demo visitors cannot open it.
 */
export async function demoAdminChatRefusal(
  request: Request,
  organizationId: string,
  sandbox: boolean,
) {
  if (!isPublicDemoMode()) return null;

  if (sandbox) {
    return Response.json(
      { error: DEMO_READ_ONLY_MESSAGE, code: DEMO_READ_ONLY_CODE },
      { status: 403 },
    );
  }

  if (await answerSafetyLimitReached(request, organizationId)) {
    return Response.json({ error: RATE_LIMITED }, { status: 429 });
  }

  return null;
}
