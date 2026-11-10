import type { CandidateStatus, RequirementRow } from "@/lib/recruitment/types";

/**
 * Auto-reject (BUSINESS_PLAN.md, 6 Nov 2026). Off per role until turned on.
 * It acts only on must-have verdicts, per the role's mode. The default acts only
 * on Contradicts, because Not shown means the resume is silent, not that the
 * person lacks the skill. The percentage score never rejects anyone.
 */

export const AUTO_REJECT_AUDIT_ACTION = "candidate.auto_reject";
export const AUTO_REJECT_UNDO_AUDIT_ACTION = "candidate.auto_reject_undo";
export const AUTO_REJECT_SETTING_AUDIT_ACTION = "job.auto_reject_setting";

/** Only someone nobody has moved yet. A person's decision always stands. */
export const AUTO_REJECT_FROM_STATUS: CandidateStatus = "new";

export const AUTO_REJECT_MODES = ["contradicts", "missing_or_contradicts"] as const;
export type AutoRejectMode = (typeof AUTO_REJECT_MODES)[number];
/** The safer trigger: only a must-have the resume contradicts. */
export const DEFAULT_AUTO_REJECT_MODE: AutoRejectMode = "contradicts";

export function isAutoRejectMode(value: unknown): value is AutoRejectMode {
  return typeof value === "string" && (AUTO_REJECT_MODES as readonly string[]).includes(value);
}

/** Reads a stored mode. Anything unknown falls back to the safer default. */
export function toAutoRejectMode(value: unknown): AutoRejectMode {
  return isAutoRejectMode(value) ? value : DEFAULT_AUTO_REJECT_MODE;
}

export function describeAutoRejectMode(mode: AutoRejectMode): string {
  return mode === "missing_or_contradicts"
    ? "when a required skill is Not shown or Contradicts"
    : "only when the resume contradicts a required skill";
}

export type AutoRejectReason = {
  skill: string;
  verdict: "not_shown" | "contradictory";
};

export function autoRejectReasons(
  rows: RequirementRow[],
  mode: AutoRejectMode = DEFAULT_AUTO_REJECT_MODE,
): AutoRejectReason[] {
  return rows.flatMap((row): AutoRejectReason[] => {
    if (row.verdict === "contradictory") return [{ skill: row.skill, verdict: row.verdict }];
    if (row.verdict === "not_shown" && mode === "missing_or_contradicts") {
      return [{ skill: row.skill, verdict: row.verdict }];
    }
    return [];
  });
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

/** The banner's lead-in, worded for the verdicts that actually triggered it. */
export function describeAutoRejectHeadline(reasons: AutoRejectReason[]): string {
  const contradicted = reasons.some((reason) => reason.verdict === "contradictory");
  const notShown = reasons.some((reason) => reason.verdict === "not_shown");
  if (contradicted && notShown) {
    return "The resume contradicts a must-have or does not show it";
  }
  if (notShown) return "The resume does not show a must-have";
  return "The resume contradicts a must-have";
}
