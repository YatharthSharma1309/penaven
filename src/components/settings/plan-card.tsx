"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { PlanSummary } from "@/lib/billing/subscription-state";

type Caps = { answers: number; screens: number; roles: number };

type PlanCardProps = {
  summary: PlanSummary;
  renewsAt: string | null;
  checkoutReady: boolean;
  proPriceUsd: number;
  free: Caps;
  pro: Caps;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function PlanCard({ summary, renewsAt, checkoutReady, proPriceUsd, free, pro }: PlanCardProps) {
  const [status, setStatus] = useState(summary.status);
  const [endsAt, setEndsAt] = useState(renewsAt);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const isPro = summary.plan === "pro";
  const caps = isPro ? pro : free;
  const date = formatDate(endsAt);

  const statusLine: Record<PlanSummary["status"], string> = {
    free: "You are on Free.",
    "awaiting-payment": "Checkout was started but not paid. Pro turns on once Razorpay confirms the payment.",
    active: date ? `Pro is active. It renews on ${date}.` : "Pro is active.",
    retrying: "Razorpay could not take the last payment and is retrying. Pro stays on meanwhile.",
    cancelling: date ? `Pro is cancelled and ends on ${date}. Until then nothing changes.` : "Pro is cancelled and ends at the close of this billing period.",
    ended: "Your Pro subscription ended, so this workspace is back on Free.",
  };

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== "string") {
        setError(data.error ?? "Checkout could not start. Try again.");
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Checkout could not start. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function cancelPro() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Cancelling did not work. Try again.");
      } else {
        setStatus("cancelling");
        if (typeof data.endsAt === "string") setEndsAt(data.endsAt);
        setCancelOpen(false);
      }
    } catch {
      setError("Cancelling did not work. Check your connection and try again.");
    }
    setBusy(false);
  }

  const canUpgrade = !isPro && status !== "awaiting-payment";
  const showResume = !isPro && status === "awaiting-payment";

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Plan</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {isPro ? `Pro · $${proPriceUsd}/month` : "Free"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{statusLine[status]}</p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Assistant answers</dt>
          <dd className="font-medium text-slate-900">{caps.answers} a month</dd>
        </div>
        <div>
          <dt className="text-slate-500">Resume screens</dt>
          <dd className="font-medium text-slate-900">{caps.screens} a month</dd>
        </div>
        <div>
          <dt className="text-slate-500">Open roles</dt>
          <dd className="font-medium text-slate-900">{caps.roles}</dd>
        </div>
      </dl>

      {!checkoutReady && !isPro ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Checkout is not set up on this server yet. Add the four RAZORPAY_ values described in DEPLOY.md.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {checkoutReady && (canUpgrade || showResume) ? (
          <Button type="button" onClick={startCheckout} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {showResume
              ? "Finish paying for Pro"
              : `Upgrade to Pro: $${proPriceUsd}/month for ${pro.answers} answers`}
          </Button>
        ) : null}
        {checkoutReady && isPro && (status === "active" || status === "retrying") ? (
          <Button type="button" variant="secondary" onClick={() => setCancelOpen(true)} disabled={busy}>
            Cancel Pro
          </Button>
        ) : null}
      </div>
      {!isPro && checkoutReady ? (
        <p className="mt-3 text-xs text-slate-500">
          Payment happens on Razorpay&apos;s page. No fee per answer, and none when a person takes the thread.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <Dialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Pro?"
        description={`Pro stays on until ${date ?? "the end of this billing period"}. After that the workspace goes back to Free: ${free.answers} answers, ${free.screens} resume screens and ${free.roles} role a month. Nothing is deleted.`}
        confirmLabel="Cancel Pro"
        variant="danger"
        isLoading={busy}
        onConfirm={cancelPro}
      />
    </Card>
  );
}
