"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  DEFAULT_AUTO_REJECT_MODE,
  describeAutoRejectMode,
  toAutoRejectMode,
  type AutoRejectMode,
} from "@/lib/recruitment/auto-reject";

type AutoRejectSettingProps = {
  jobId: string;
  enabled: boolean;
  /** The stored trigger. Unknown values read as the safer default. */
  mode: string;
  canChange: boolean;
};

const MODE_OPTIONS: { value: AutoRejectMode; label: string; detail: string; warning?: string }[] = [
  {
    value: "contradicts",
    label: "Contradicts only (recommended)",
    detail: "Rejects only when the resume states the opposite of a required skill.",
  },
  {
    value: "missing_or_contradicts",
    label: "Not shown or Contradicts",
    detail: "Also rejects when the resume does not establish a required skill.",
    warning:
      "A resume that simply doesn't mention a skill will be rejected, even if the person has it.",
  },
];

export function AutoRejectSetting({ jobId, enabled, mode, canChange }: AutoRejectSettingProps) {
  const router = useRouter();
  const activeMode = toAutoRejectMode(mode);
  const [confirming, setConfirming] = useState(false);
  const [chosenMode, setChosenMode] = useState<AutoRejectMode>(DEFAULT_AUTO_REJECT_MODE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recruitment/jobs/${jobId}/auto-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { enabled: true, mode: chosenMode } : { enabled: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The setting was not saved.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startTurningOn() {
    // Every time it is turned on, the recommended trigger is the starting choice.
    setChosenMode(DEFAULT_AUTO_REJECT_MODE);
    setConfirming(true);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle>Auto-reject</CardTitle>
            <Badge tone={enabled ? "danger" : "default"}>{enabled ? "On" : "Off"}</Badge>
          </div>
          {enabled ? (
            <p className="mt-2 text-sm font-medium text-slate-800">
              Trigger: rejects {describeAutoRejectMode(activeMode)}.
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-slate-600">
            When on, a person still on New is moved to Rejected after their screen if a required
            skill matches the trigger you pick: Contradicts only, or Not shown or Contradicts. The
            match score never rejects anyone. Nobody is emailed, each one is written to the activity
            log, and one click on the candidate undoes it. People already screened are not changed.
          </p>
          {!canChange ? (
            <p className="mt-2 text-xs text-slate-500">Only an admin can change this.</p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        </div>
        {canChange ? (
          <Button
            type="button"
            variant={enabled ? "secondary" : "danger"}
            size="sm"
            disabled={busy}
            onClick={() => (enabled ? save(false) : startTurningOn())}
          >
            {enabled ? "Turn off" : "Turn on"}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        title="Turn on auto-reject for this role?"
        description="From now on, a newly screened person on New is rejected when a required skill matches the trigger below. Check that the required skills are true must-haves first."
        confirmLabel="Turn on"
        variant="danger"
        isLoading={busy}
        onConfirm={() => save(true)}
      >
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Reject when</legend>
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <input
                type="radio"
                name={`auto-reject-mode-${jobId}`}
                value={option.value}
                checked={chosenMode === option.value}
                onChange={() => setChosenMode(option.value)}
                disabled={busy}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="block text-muted">{option.detail}</span>
                {option.warning ? (
                  <span className="mt-1 block text-rose-700">{option.warning}</span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <p className="font-medium">Hiring laws may apply to you</p>
          <p className="mt-1">
            If you hire in New York City, this setting likely makes Penaven an automated employment
            decision tool. That requires a yearly independent bias audit and notice to candidates
            before it is used. Illinois requires telling candidates that AI is used in hiring. In
            the EU, a fully automated rejection may not be allowed. You, the employer, are
            responsible for these. Penaven does not send the notices. This is not legal advice.
          </p>
        </div>
      </Dialog>
    </Card>
  );
}
