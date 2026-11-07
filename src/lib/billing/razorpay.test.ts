import { describe, expect, it, vi } from "vitest";
import {
  RazorpayError,
  cancelSubscriptionAtCycleEnd,
  createProSubscription,
  fetchSubscription,
  razorpayConfig,
  subscriptionFromEvent,
  subscriptionUpdateFor,
  verifyWebhookSignature,
} from "@/lib/billing/razorpay";
import { canCancel, hasLivePro, planSummary } from "@/lib/billing/subscription-state";

const config = {
  keyId: "rzp_test_key",
  keySecret: "secret",
  proPlanId: "plan_pro",
  webhookSecret: "whsec",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("razorpayConfig", () => {
  it("is null until all four values are set", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(
      razorpayConfig({
        RAZORPAY_KEY_ID: "k",
        RAZORPAY_KEY_SECRET: "s",
        RAZORPAY_PRO_PLAN_ID: " ",
        RAZORPAY_WEBHOOK_SECRET: "w",
      }),
    ).toBeNull();
    expect(
      razorpayConfig({
        RAZORPAY_KEY_ID: "k",
        RAZORPAY_KEY_SECRET: "s",
        RAZORPAY_PRO_PLAN_ID: "plan_1",
        RAZORPAY_WEBHOOK_SECRET: "w",
      }),
    ).toEqual({ keyId: "k", keySecret: "s", proPlanId: "plan_1", webhookSecret: "w" });
  });
});

describe("verifyWebhookSignature", () => {
  // The example from Razorpay's Node SDK documentation.
  const body = '{"a":1,"b":2,"c":{"d":3}}';
  const signature = "2fe04e22977002e6c7cb553adab8b460cb9e2a4970d5953cb27a8472752e3bbc";

  it("accepts Razorpay's documented example", () => {
    expect(verifyWebhookSignature(body, signature, "123456")).toBe(true);
  });

  it("rejects a changed body, a wrong secret, and malformed or missing signatures", () => {
    expect(verifyWebhookSignature(`${body} `, signature, "123456")).toBe(false);
    expect(verifyWebhookSignature(body, signature, "654321")).toBe(false);
    expect(verifyWebhookSignature(body, signature.slice(0, 63), "123456")).toBe(false);
    expect(verifyWebhookSignature(body, `${signature}00`, "123456")).toBe(false);
    expect(verifyWebhookSignature(body, "zz".repeat(32), "123456")).toBe(false);
    expect(verifyWebhookSignature(body, null, "123456")).toBe(false);
  });
});

describe("Razorpay requests", () => {
  it("creates a Pro subscription tagged with the workspace", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: "sub_1", status: "created", short_url: "https://rzp.io/i/x" }),
    );
    const result = await createProSubscription(config, "org_1", fetchImpl as typeof fetch);

    expect(result.short_url).toBe("https://rzp.io/i/x");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`,
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      plan_id: "plan_pro",
      notes: { organizationId: "org_1" },
    });
  });

  it("cancels at the end of the cycle", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "sub_1", status: "active" }));
    await cancelSubscriptionAtCycleEnd(config, "sub_1", fetchImpl as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions/sub_1/cancel");
    expect(JSON.parse(String(init.body))).toEqual({ cancel_at_cycle_end: true });
  });

  it("reads a subscription with GET and no body", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "sub_1", status: "created" }));
    await fetchSubscription(config, "sub_1", fetchImpl as typeof fetch);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("refuses ids that could change the request path", () => {
    expect(() => fetchSubscription(config, "../payments")).toThrow(RazorpayError);
    expect(() => cancelSubscriptionAtCycleEnd(config, "sub_1/../x")).toThrow(RazorpayError);
  });

  it("turns a Razorpay error into a RazorpayError with its description", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { description: "The plan id is invalid" } }, 400),
    );
    await expect(
      createProSubscription(config, "org_1", fetchImpl as typeof fetch),
    ).rejects.toThrow(/plan id is invalid/);
  });
});

describe("subscriptionFromEvent", () => {
  it("reads the subscription from subscription events only", () => {
    const entity = { id: "sub_1", status: "active", current_end: 1_800_000_000 };
    expect(
      subscriptionFromEvent({ event: "subscription.activated", payload: { subscription: { entity } } }),
    ).toEqual(entity);
    expect(
      subscriptionFromEvent({ event: "payment.captured", payload: { subscription: { entity } } }),
    ).toBeNull();
    expect(subscriptionFromEvent({ event: "subscription.charged", payload: {} })).toBeNull();
    expect(subscriptionFromEvent("nope")).toBeNull();
  });
});

describe("subscriptionUpdateFor", () => {
  const current = { razorpaySubscriptionId: "sub_1", subscriptionStatus: "created" };

  it("turns Pro on when the subscription is active and records the renewal date", () => {
    expect(
      subscriptionUpdateFor(current, { id: "sub_1", status: "active", current_end: 1_800_000_000 }),
    ).toEqual({
      plan: "PRO",
      subscriptionStatus: "active",
      planRenewsAt: new Date(1_800_000_000 * 1000),
    });
  });

  it("keeps Pro while Razorpay retries a failed charge, and drops it when it halts", () => {
    const active = { razorpaySubscriptionId: "sub_1", subscriptionStatus: "active" };
    expect(subscriptionUpdateFor(active, { id: "sub_1", status: "pending" })?.plan).toBe("PRO");
    expect(subscriptionUpdateFor(active, { id: "sub_1", status: "halted" })?.plan).toBe("FREE");
  });

  it("drops Pro when the subscription is cancelled or completed", () => {
    const active = { razorpaySubscriptionId: "sub_1", subscriptionStatus: "active" };
    expect(subscriptionUpdateFor(active, { id: "sub_1", status: "cancelled" })?.plan).toBe("FREE");
    expect(subscriptionUpdateFor(active, { id: "sub_1", status: "completed" })?.plan).toBe("FREE");
  });

  it("ignores events for any other subscription", () => {
    expect(subscriptionUpdateFor(current, { id: "sub_2", status: "active" })).toBeNull();
    expect(
      subscriptionUpdateFor(
        { razorpaySubscriptionId: null, subscriptionStatus: null },
        { id: "sub_1", status: "active" },
      ),
    ).toBeNull();
  });

  it("never revives a subscription that already ended, whatever order events arrive in", () => {
    const ended = { razorpaySubscriptionId: "sub_1", subscriptionStatus: "cancelled" };
    expect(subscriptionUpdateFor(ended, { id: "sub_1", status: "active" })).toBeNull();
  });

  it("keeps showing a pressed Cancel while Razorpay still reports active", () => {
    const cancelling = { razorpaySubscriptionId: "sub_1", subscriptionStatus: "cancelling" };
    expect(subscriptionUpdateFor(cancelling, { id: "sub_1", status: "active" })).toMatchObject({
      plan: "PRO",
      subscriptionStatus: "cancelling",
    });
  });
});

describe("subscription state", () => {
  it("summarises each state for Settings", () => {
    expect(planSummary({ plan: "FREE", subscriptionStatus: null }).status).toBe("free");
    expect(planSummary({ plan: "FREE", subscriptionStatus: "created" }).status).toBe("awaiting-payment");
    expect(planSummary({ plan: "PRO", subscriptionStatus: "active" }).status).toBe("active");
    expect(planSummary({ plan: "PRO", subscriptionStatus: "pending" }).status).toBe("retrying");
    expect(planSummary({ plan: "PRO", subscriptionStatus: "cancelling" }).status).toBe("cancelling");
    expect(planSummary({ plan: "FREE", subscriptionStatus: "cancelled" }).status).toBe("ended");
  });

  it("allows a new checkout only off Pro, and Cancel only on uncancelled Pro", () => {
    expect(hasLivePro({ plan: "PRO", subscriptionStatus: "active" })).toBe(true);
    expect(hasLivePro({ plan: "FREE", subscriptionStatus: "cancelled" })).toBe(false);
    expect(canCancel({ plan: "PRO", subscriptionStatus: "active" })).toBe(true);
    expect(canCancel({ plan: "PRO", subscriptionStatus: "cancelling" })).toBe(false);
    expect(canCancel({ plan: "FREE", subscriptionStatus: "active" })).toBe(false);
  });
});
