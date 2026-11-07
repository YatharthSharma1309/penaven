"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

type AutoRejectSettingProps = {
  jobId: string;
  enabled: boolean;
  canChange: boolean;
};

export function AutoRejectSetting({ jobId, enabled, canChange }: AutoRejectSettingProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recruitment/jobs/${jobId}/auto-reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
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

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle>Auto-reject</CardTitle>
            <Badge tone={enabled ? "danger" : "default"}>{enabled ? "On" : "Off"}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            When on, a person still on New is moved to Rejected after their screen if a required
            skill is marked Not shown or Contradicts. The match score never rejects anyone. Nobody is
            emailed, each one is written to the activity log, and one click on the candidate undoes
            it. People already screened are not changed.
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
            onClick={() => (enabled ? save(false) : setConfirming(true))}
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
        description="From now on, a newly screened person on New is rejected when a required skill is Not shown or Contradicts. Check that the required skills are true must-haves first. A resume that says a skill in other words can still be marked Not shown."
        confirmLabel="Turn on"
        variant="danger"
        isLoading={busy}
        onConfirm={() => save(true)}
      />
    </Card>
  );
}
