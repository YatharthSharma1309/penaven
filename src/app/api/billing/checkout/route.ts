import { NextResponse } from "next/server";
import { withAdminMembership } from "@/lib/auth/api";
import {
  RazorpayError,
  createProSubscription,
  fetchSubscription,
  razorpayConfig,
} from "@/lib/billing/razorpay";
import { hasLivePro } from "@/lib/billing/subscription-state";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Starts Pro checkout and returns Razorpay's hosted payment page. Pro only applies once the webhook confirms payment. */
export async function POST() {
  return withAdminMembership(async ({ organization }) => {
    const config = razorpayConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Checkout is not set up on this server yet." },
        { status: 503 },
      );
    }

    if (await checkRateLimit(`billing-checkout:${organization.id}`, 5, 60_000)) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Wait a minute and try again." },
        { status: 429 },
      );
    }

    const current = await db.organization.findUnique({
      where: { id: organization.id },
      select: { plan: true, subscriptionStatus: true, razorpaySubscriptionId: true },
    });
    if (current && hasLivePro(current)) {
      return NextResponse.json({ error: "This workspace is already on Pro." }, { status: 409 });
    }
    if (current?.subscriptionStatus === "authenticated") {
      return NextResponse.json(
        { error: "Razorpay is confirming your payment. Pro turns on when it does." },
        { status: 409 },
      );
    }

    try {
      // Reuse an unpaid checkout: a second subscription would leave the first
      // payment link live, and a payment there would be ignored.
      if (current?.razorpaySubscriptionId && current.subscriptionStatus === "created") {
        const pending = await fetchSubscription(config, current.razorpaySubscriptionId);
        if (pending.status === "created" && pending.short_url) {
          return NextResponse.json({ url: pending.short_url });
        }
      }

      const subscription = await createProSubscription(config, organization.id);
      if (!subscription.short_url) {
        return NextResponse.json(
          { error: "Razorpay did not return a payment page. Try again." },
          { status: 502 },
        );
      }

      await db.organization.update({
        where: { id: organization.id },
        data: {
          razorpaySubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
        },
      });

      return NextResponse.json({ url: subscription.short_url });
    } catch (error) {
      if (error instanceof RazorpayError) {
        console.error(error.message);
        return NextResponse.json(
          { error: "Razorpay could not start checkout. Try again in a few minutes." },
          { status: 502 },
        );
      }
      throw error;
    }
  });
}
