import { NextResponse } from "next/server";
import { readBodyLimited } from "@/lib/api/json";
import {
  razorpayConfig,
  subscriptionFromEvent,
  subscriptionUpdateFor,
  verifyWebhookSignature,
} from "@/lib/billing/razorpay";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Razorpay calls this for subscription events. The signature is checked
 * against the raw body before anything is parsed. Events this workspace does
 * not need still get a 200, or Razorpay retries them for a day.
 */
export async function POST(request: Request) {
  const config = razorpayConfig();
  if (!config) {
    return NextResponse.json({ error: "Checkout is not set up on this server." }, { status: 503 });
  }

  const bytes = await readBodyLimited(request, MAX_BODY_BYTES);
  if (bytes === "too-large") {
    return NextResponse.json({ error: "Body too large." }, { status: 413 });
  }
  if (bytes === "unreadable") {
    return NextResponse.json({ error: "Body unreadable." }, { status: 400 });
  }

  const rawBody = new TextDecoder().decode(bytes);
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature, config.webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const subscription = subscriptionFromEvent(body);
  if (!subscription) return NextResponse.json({ received: true, applied: false });

  const organization = await db.organization.findUnique({
    where: { razorpaySubscriptionId: subscription.id },
    select: { id: true, razorpaySubscriptionId: true, subscriptionStatus: true },
  });
  if (!organization) return NextResponse.json({ received: true, applied: false });

  const update = subscriptionUpdateFor(organization, subscription);
  if (!update) return NextResponse.json({ received: true, applied: false });

  // Only apply if no other event changed the status since it was read.
  const result = await db.organization.updateMany({
    where: {
      id: organization.id,
      razorpaySubscriptionId: subscription.id,
      subscriptionStatus: organization.subscriptionStatus,
    },
    data: update,
  });

  if (result.count === 0) {
    // Lost a race with another event for this subscription: ask Razorpay to retry.
    return NextResponse.json({ error: "Changed meanwhile, retry." }, { status: 409 });
  }

  return NextResponse.json({ received: true, applied: true, plan: update.plan });
}
