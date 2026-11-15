"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type WidgetIntakeRun = {
  id: string;
  createdAt: Date | string;
  conversationId: string | null;
};

export function WidgetIntakeRunSelector({
  runs,
  selectedRunId,
}: {
  runs: WidgetIntakeRun[];
  selectedRunId: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground-soft">
        Widget intake run
      </label>
      <Select
        value={selectedRunId}
        onChange={(event) => {
          const next = event.target.value;
          router.push(`/widget/intake/${next}`);
        }}
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {formatDate(run.createdAt)}{" "}
            {run.conversationId ? `· ${run.conversationId.slice(-6)}` : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

