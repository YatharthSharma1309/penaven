import type { RequirementRow, RequirementVerdict } from "@/lib/recruitment/types";
import { cn } from "@/lib/utils";

const verdictLabel: Record<RequirementVerdict, string> = {
  shown: "Shown",
  inferred: "Inferred",
  unverified: "Unverified",
  not_shown: "Not shown",
  contradictory: "Contradicts",
};

const verdictTone: Record<RequirementVerdict, string> = {
  shown: "text-accent",
  inferred: "text-amber-700",
  unverified: "text-slate-500",
  not_shown: "text-rose-700",
  contradictory: "text-rose-700",
};

type RequirementChecklistProps = {
  rows: RequirementRow[];
  legend?: boolean;
};

export function RequirementLegend() {
  return (
    <p className="text-xs leading-5 text-slate-500">
      Shown means the resume quotes that requirement. Inferred is an indirect
      reading. Unverified was counted without a quote. Not shown means the
      resume does not establish it. Contradicts means the resume states the
      opposite. Neither is proof the person lacks the skill.
    </p>
  );
}

export function RequirementChecklist({ rows, legend = true }: RequirementChecklistProps) {
  if (rows.length === 0) return null;

  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {rows.map((row) => (
          <li
            key={row.skill}
            className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{row.skill}</p>
              {row.evidence ? (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  &ldquo;{row.evidence}&rdquo;
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  {row.verdict === "not_shown"
                    ? "The resume does not establish this requirement."
                    : row.verdict === "contradictory"
                      ? "The resume states the opposite of this requirement."
                      : "Matched without a quote from the resume."}
                </p>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 text-xs font-semibold uppercase tracking-wide",
                verdictTone[row.verdict],
              )}
            >
              {verdictLabel[row.verdict]}
            </span>
          </li>
        ))}
      </ul>
      {legend ? (
        <div className="mt-2">
          <RequirementLegend />
        </div>
      ) : null}
    </div>
  );
}
