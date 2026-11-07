import { createHmac, timingSafeEqual } from "node:crypto";
import type { StoredPlan } from "@/lib/billing/plans";

/**
 * Razorpay Subscriptions over plain REST: no SDK, so nothing new to install.
 * The Pro plan ($39/month) is created once in the Razorpay dashboard and its
 * id goes in RAZORPAY_PRO_PLAN_ID. Test-mode keys move no money.
 */

const API_BASE = "https://api.razorpay.com/v1";

/** Monthly cycles before Razorpay ends the subscription on its own (10 years). */
const TOTAL_CYCLES = 120;

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  proPlanId: string;
  webhookSecret: string;
};

/** Null until all four values are set, so checkout stays hidden on a half-configured deploy. */
export function razorpayConfig(
  env: Record<string, string | undefined> = process.env,
): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const proPlanId = env.RAZORPAY_PRO_PLAN_ID?.trim();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!keyId || !keySecret || !proPlanId || !webhookSecret) return null;
  return { keyId, keySecret, proPlanId, webhookSecret };
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

export type RazorpaySubscription = {
  id: string;
  status: string;
  short_url?: string | null;
  current_end?: number | null;
  notes?: Record<string, unknown> | null;
};

const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;

async function razorpayRequest(
  config: RazorpayConfig,
  path: string,
  body: Record<string, unknown> | null,
  fetchImpl: typeof fetch,
): Promise<RazorpaySubscription> {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json().catch(() => null)) as
    | (RazorpaySubscription & { error?: { description?: string } })
    | null;

  if (!response.ok || !data?.id) {
    const reason = data?.error?.description ?? `HTTP ${response.status}`;
    throw new RazorpayError(`Razorpay refused the request: ${reason}`, response.status);
  }
  return data;
}

/** Starts a Pro subscription. The customer pays on Razorpay's hosted page at `short_url`. */
export function createProSubscription(
  config: RazorpayConfig,
  organizationId: string,
  fetchImpl: typeof fetch = fetch,
) {
  return razorpayRequest(
    config,
    "/subscriptions",
    {
      plan_id: config.proPlanId,
      total_count: TOTAL_CYCLES,
      quantity: 1,
      customer_notify: true,
      notes: { organizationId },
    },
    fetchImpl,
  );
}

/** Cancels at the end of the paid period, so the workspace keeps Pro until then. */
export function cancelSubscriptionAtCycleEnd(
  config: RazorpayConfig,
  subscriptionId: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!SUBSCRIPTION_ID.test(subscriptionId)) {
    throw new RazorpayError("That is not a Razorpay subscription id.", 400);
  }
  return razorpayRequest(
    config,
    `/subscriptions/${subscriptionId}/cancel`,
    { cancel_at_cycle_end: true },
    fetchImpl,
  );
}

/** Reads a subscription, e.g. to reuse an unpaid one's payment page. */
export function fetchSubscription(
  config: RazorpayConfig,
  subscriptionId: string,
  fetchImpl: typeof fetch = fetch,
) {
  if (!SUBSCRIPTION_ID.test(subscriptionId)) {
    throw new RazorpayError("That is not a Razorpay subscription id.", 400);
  }
  return razorpayRequest(config, `/subscriptions/${subscriptionId}`, null, fetchImpl);
}

/** X-Razorpay-Signature is the hex HMAC-SHA256 of the raw body, keyed by the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Statuses after which Razorpay never bills the subscription again. */
const ENDED = new Set(["cancelled", "completed", "expired"]);

/** Statuses that keep Pro: paid, or a failed charge Razorpay is still retrying. */
const PAID = new Set(["active", "pending"]);

export type SubscriptionUpdate = {
  plan: StoredPlan;
  subscriptionStatus: string;
  planRenewsAt: Date | null;
};

/**
 * What a subscription event does to a workspace, or null to ignore it.
 *
 * Events can arrive late or out of order, so an event never revives a
 * subscription this workspace already saw end, and never touches a workspace
 * whose current subscription is a different one.
 */
export function subscriptionUpdateFor(
  current: { razorpaySubscriptionId: string | null; subscriptionStatus: string | null },
  subscription: RazorpaySubscription,
): SubscriptionUpdate | null {
  if (!current.razorpaySubscriptionId || current.razorpaySubscriptionId !== subscription.id) {
    return null;
  }
  if (current.subscriptionStatus && ENDED.has(current.subscriptionStatus)) return null;

  const status = subscription.status;
  const renewsAt =
    typeof subscription.current_end === "number" && subscription.current_end > 0
      ? new Date(subscription.current_end * 1000)
      : null;

  // Cancel was pressed: Razorpay still says active until the period ends.
  // Keep "cancelling" so Settings does not offer Cancel again.
  const subscriptionStatus =
    current.subscriptionStatus === "cancelling" && status === "active" ? "cancelling" : status;

  return {
    plan: PAID.has(status) ? "PRO" : "FREE",
    subscriptionStatus,
    planRenewsAt: renewsAt,
  };
}

type WebhookEvent = {
  event?: unknown;
  payload?: { subscription?: { entity?: unknown } };
};

/** The subscription inside a `subscription.*` event, or null for any other event. */
export function subscriptionFromEvent(body: unknown): RazorpaySubscription | null {
  if (!body || typeof body !== "object") return null;
  const event = body as WebhookEvent;
  if (typeof event.event !== "string" || !event.event.startsWith("subscription.")) return null;
  const entity = event.payload?.subscription?.entity;
  if (!entity || typeof entity !== "object") return null;
  const { id, status } = entity as Record<string, unknown>;
  if (typeof id !== "string" || typeof status !== "string") return null;
  return entity as RazorpaySubscription;
}
