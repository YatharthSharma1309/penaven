import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type OrgRow = {
  id: string;
  plan: "FREE" | "PRO";
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
  planRenewsAt: Date | null;
};

const store = vi.hoisted(() => ({ orgs: [] as OrgRow[], raceOnce: false }));

vi.mock("@/lib/db", () => ({
  db: {
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { razorpaySubscriptionId: string } }) =>
        store.orgs.find((row) => row.razorpaySubscriptionId === where.razorpaySubscriptionId) ??
        null,
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; razorpaySubscriptionId: string; subscriptionStatus: string | null };
          data: Partial<OrgRow>;
        }) => {
          if (store.raceOnce) {
            store.raceOnce = false;
            return { count: 0 };
          }
          const rows = store.orgs.filter(
            (row) =>
              row.id === where.id &&
              row.razorpaySubscriptionId === where.razorpaySubscriptionId &&
              row.subscriptionStatus === where.subscriptionStatus,
          );
          rows.forEach((row) => Object.assign(row, data));
          return { count: rows.length };
        },
      ),
    },
  },
}));

const { POST } = await import("@/app/api/webhooks/razorpay/route");

const SECRET = "whsec_test";
const ENV = {
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_PRO_PLAN_ID: "plan_pro",
  RAZORPAY_WEBHOOK_SECRET: SECRET,
};

function event(name: string, entity: Record<string, unknown>) {
  return JSON.stringify({ entity: "event", event: name, payload: { subscription: { entity } } });
}

function send(body: string, signature = createHmac("sha256", SECRET).update(body).digest("hex")) {
  return POST(
    new Request("http://localhost/api/webhooks/razorpay", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
      body,
    }),
  );
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  store.raceOnce = false;
  store.orgs = [
    {
      id: "org_1",
      plan: "FREE",
      razorpaySubscriptionId: "sub_1",
      subscriptionStatus: "created",
      planRenewsAt: null,
    },
  ];
});

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key];
});

describe("POST /api/webhooks/razorpay", () => {
  it("turns Pro on when the subscription activates", async () => {
    const response = await send(
      event("subscription.activated", { id: "sub_1", status: "active", current_end: 1_800_000_000 }),
    );
    expect(response.status).toBe(200);
    expect(store.orgs[0]).toMatchObject({
      plan: "PRO",
      subscriptionStatus: "active",
      planRenewsAt: new Date(1_800_000_000 * 1000),
    });
  });

  it("refuses a body that was not signed with the webhook secret", async () => {
    const body = event("subscription.activated", { id: "sub_1", status: "active" });
    const forged = createHmac("sha256", "someone-else").update(body).digest("hex");
    const response = await send(body, forged);
    expect(response.status).toBe(401);
    expect(store.orgs[0].plan).toBe("FREE");
  });

  it("acknowledges events it does not use without changing anything", async () => {
    const unknown = await send(event("subscription.activated", { id: "sub_9", status: "active" }));
    const payment = await send(JSON.stringify({ event: "payment.captured", payload: {} }));
    expect(unknown.status).toBe(200);
    expect(payment.status).toBe(200);
    expect(store.orgs[0].plan).toBe("FREE");
  });

  it("goes back to Free when the subscription is cancelled, and a late activation does not undo it", async () => {
    await send(event("subscription.activated", { id: "sub_1", status: "active" }));
    await send(event("subscription.cancelled", { id: "sub_1", status: "cancelled" }));
    expect(store.orgs[0]).toMatchObject({ plan: "FREE", subscriptionStatus: "cancelled" });

    await send(event("subscription.activated", { id: "sub_1", status: "active" }));
    expect(store.orgs[0].plan).toBe("FREE");
  });

  it("asks Razorpay to retry when another event changed the workspace meanwhile", async () => {
    store.raceOnce = true;
    const response = await send(event("subscription.activated", { id: "sub_1", status: "active" }));
    expect(response.status).toBe(409);
  });

  it("is switched off until checkout is configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const response = await send(event("subscription.activated", { id: "sub_1", status: "active" }));
    expect(response.status).toBe(503);
  });
});
