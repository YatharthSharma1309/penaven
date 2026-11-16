"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ManualCandidateFormProps = {
  jobId: string;
};

export function ManualCandidateForm({ jobId }: ManualCandidateFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [rawText, setRawText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/recruitment/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, displayName, rawText }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to add candidate");
      setBusy(false);
      return;
    }

    setDisplayName("");
    setRawText("");
    setExpanded(false);
    router.refresh();
    setBusy(false);
  }

  if (!expanded) {
    return (
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        <UserPlus className="h-4 w-4" />
        Add candidate manually
      </Button>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="candidate-name"
            className="mb-2 block text-sm font-medium text-foreground-soft"
          >
            Candidate name
          </label>
          <Input
            id="candidate-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            placeholder="Jane Smith"
          />
        </div>

        <div>
          <label
            htmlFor="candidate-resume"
            className="mb-2 block text-sm font-medium text-foreground-soft"
          >
            Resume text
          </label>
          <Textarea
            id="candidate-resume"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            required
            rows={8}
            placeholder="Paste resume content here (minimum 50 characters)..."
          />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Adding..." : "Add candidate"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
