import { NextResponse } from "next/server";
import { withAdminMembership } from "@/lib/auth/api";
import {
  RazorpayError,
  cancelSubscriptionAtCycleEnd,
  razorpayConfig,
} from "@/lib/billing/razorpay";
import { canCancel } from "@/lib/billing/subscription-state";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Cancels Pro at the end of the paid period. The workspace keeps Pro until Razorpay ends it. */
export async function POST() {
  return withAdminMembership(async ({ organization }) => {
    const config = razorpayConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Checkout is not set up on this server yet." },
        { status: 503 },
      );
    }

    const current = await db.organization.findUnique({
      where: { id: organization.id },
      select: { plan: true, subscriptionStatus: true, razorpaySubscriptionId: true },
    });
    if (!current?.razorpaySubscriptionId || !canCancel(current)) {
      return NextResponse.json(
        { error: "There is no active Pro subscription to cancel." },
        { status: 409 },
      );
    }

    try {
      const subscription = await cancelSubscriptionAtCycleEnd(
        config,
        current.razorpaySubscriptionId,
      );
      const renewsAt =
        typeof subscription.current_end === "number" && subscription.current_end > 0
          ? new Date(subscription.current_end * 1000)
          : null;

      await db.organization.updateMany({
        where: {
          id: organization.id,
          razorpaySubscriptionId: current.razorpaySubscriptionId,
        },
        data: {
          subscriptionStatus: subscription.status === "cancelled" ? "cancelled" : "cancelling",
          ...(subscription.status === "cancelled" ? { plan: "FREE" as const } : {}),
          ...(renewsAt ? { planRenewsAt: renewsAt } : {}),
        },
      });

      return NextResponse.json({ cancelled: true, endsAt: renewsAt?.toISOString() ?? null });
    } catch (error) {
      if (error instanceof RazorpayError) {
        console.error(error.message);
        return NextResponse.json(
          { error: "Razorpay could not cancel the subscription. Try again in a few minutes." },
          { status: 502 },
        );
      }
      throw error;
    }
  });
}
