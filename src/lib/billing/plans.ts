/**
 * One published price. Caps are sized so a heavy month stays inside it.
 *
 * Gemini 3.5 Flash paid standard (ai.google.dev, 21 Oct 2026):
 * $1.50 / 1M input, $9.00 / 1M output, thinking tokens included in output.
 * A heavy widget reply (~3k in + 8k out) is about $0.08.
 * A heavy resume screen (~8k in + 4k out) is about $0.05.
 * Pro: 250 replies + 40 screens is about $21, under $39.
 *
 * A workspace is Free until the Razorpay webhook stores Pro on it. The public
 * demo skips these caps so the shared sample inbox keeps working.
 */

import { visitorHandoffStep } from "@/lib/chat/answer-outcome";

export const GEMINI_FLASH_USD_PER_MILLION = {
  input: 1.5,
  output: 9,
} as const;

export const PLANS = {
  free: {
    id: "free",
    priceUsd: 0,
    assistantAnswersPerMonth: 40,
    resumeScreensPerMonth: 5,
    roles: 1,
  },
  pro: {
    id: "pro",
    priceUsd: 39,
    assistantAnswersPerMonth: 250,
    resumeScreensPerMonth: 40,
    roles: 5,
  },
} as const;

export type WorkspacePlan = (typeof PLANS)["free"] | (typeof PLANS)["pro"];

/** The plan stored on Organization.plan. */
export type StoredPlan = "FREE" | "PRO";

/** Null means uncapped (public demo). Otherwise the stored plan, Free when none is stored. */
export function planForWorkspace(options: {
  publicDemo: boolean;
  storedPlan?: StoredPlan | null;
}): WorkspacePlan | null {
  if (options.publicDemo) return null;
  return options.storedPlan === "PRO" ? PLANS.pro : PLANS.free;
}

export function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function isAtMonthlyCap(used: number, cap: number) {
  return used >= cap;
}

export function tokenCostUsd(
  inputTokens: number,
  outputTokens: number,
  rates = GEMINI_FLASH_USD_PER_MILLION,
) {
  return (
    (inputTokens / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output
  );
}

/** Worst-case model spend if every included Pro answer and screen is heavy. */
export function proHeavyMonthUsd() {
  const reply = tokenCostUsd(3_000, 8_000);
  const screen = tokenCostUsd(8_000, 4_000);
  return (
    PLANS.pro.assistantAnswersPerMonth * reply +
    PLANS.pro.resumeScreensPerMonth * screen
  );
}

export function assistantCapReply(
  channel: "WIDGET" | "HELP_CENTER" | "ADMIN",
  plan: WorkspacePlan = PLANS.free,
) {
  if (channel === "ADMIN") {
    if (plan.id === "pro") {
      return `This workspace has used its ${plan.assistantAnswersPerMonth} included answers for the month. The count resets on the 1st (UTC).`;
    }
    return `This workspace has used its ${PLANS.free.assistantAnswersPerMonth} included answers for the month. Pro is $${PLANS.pro.priceUsd}/month for ${PLANS.pro.assistantAnswersPerMonth} answers. Upgrade in Settings.`;
  }

  // The visitor is the business's customer: no plan, workspace, or quota talk.
  return `I can't answer more questions here right now. A person can pick this up. ${visitorHandoffStep()}`;
}

export function resumeScreenCapMessage(plan: WorkspacePlan = PLANS.free) {
  if (plan.id === "pro") {
    return `This workspace has used its ${plan.resumeScreensPerMonth} resume screens for the month. The count resets on the 1st (UTC).`;
  }
  return `This workspace has used its ${PLANS.free.resumeScreensPerMonth} resume screens for the month. Pro includes ${PLANS.pro.resumeScreensPerMonth} a month at $${PLANS.pro.priceUsd}. Upgrade in Settings.`;
}

export function roleCapMessage(plan: WorkspacePlan = PLANS.free) {
  if (plan.id === "pro") {
    return `Pro includes ${plan.roles} roles, and this workspace has ${plan.roles} open.`;
  }
  return `Free includes ${PLANS.free.roles} role. Pro includes ${PLANS.pro.roles} roles at $${PLANS.pro.priceUsd}/month. Upgrade in Settings.`;
}
