import type { CandidateStatus, RequirementRow } from "@/lib/recruitment/types";

/**
 * Auto-reject (BUSINESS_PLAN.md, 6 Nov 2026). Off per role until turned on.
 * It acts only on a must-have the review marked Not shown or Contradicts.
 * The percentage score never rejects anyone.
 */

export const AUTO_REJECT_AUDIT_ACTION = "candidate.auto_reject";
export const AUTO_REJECT_UNDO_AUDIT_ACTION = "candidate.auto_reject_undo";
export const AUTO_REJECT_SETTING_AUDIT_ACTION = "job.auto_reject_setting";

/** Only someone nobody has moved yet. A person's decision always stands. */
export const AUTO_REJECT_FROM_STATUS: CandidateStatus = "new";

export type AutoRejectReason = {
  skill: string;
  verdict: "not_shown" | "contradictory";
};

export function autoRejectReasons(rows: RequirementRow[]): AutoRejectReason[] {
  return rows.flatMap((row) =>
    row.verdict === "not_shown" || row.verdict === "contradictory"
      ? [{ skill: row.skill, verdict: row.verdict }]
      : [],
  );
}

export function parseAutoRejectReasons(value: string | null): AutoRejectReason[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { skill, verdict } = item as Record<string, unknown>;
      if (typeof skill !== "string") return [];
      if (verdict !== "not_shown" && verdict !== "contradictory") return [];
      return [{ skill, verdict }];
    });
  } catch {
    return [];
  }
}

export function describeAutoRejectReasons(reasons: AutoRejectReason[]): string {
  return reasons
    .map((reason) =>
      reason.verdict === "contradictory"
        ? `${reason.skill} (resume contradicts it)`
        : `${reason.skill} (not shown)`,
    )
    .join(", ");
}
