/** Pure reads of the plan fields on Organization, shared by the routes and Settings. */

type PlanState = { plan: "FREE" | "PRO"; subscriptionStatus: string | null };

/** Pro that is paid for or still being retried. A new checkout would bill twice. */
export function hasLivePro(state: PlanState) {
  return state.plan === "PRO";
}

/** Pro that has not already been cancelled. */
export function canCancel(state: PlanState) {
  return (
    state.plan === "PRO" &&
    (state.subscriptionStatus === "active" || state.subscriptionStatus === "pending")
  );
}

export type PlanSummary = {
  plan: "free" | "pro";
  /** What Settings says under the plan name. */
  status: "free" | "awaiting-payment" | "active" | "retrying" | "cancelling" | "ended";
};

export function planSummary(state: PlanState): PlanSummary {
  const status = state.subscriptionStatus;
  if (state.plan === "PRO") {
    if (status === "cancelling") return { plan: "pro", status: "cancelling" };
    if (status === "pending") return { plan: "pro", status: "retrying" };
    return { plan: "pro", status: "active" };
  }
  if (status === "created" || status === "authenticated") {
    return { plan: "free", status: "awaiting-payment" };
  }
  if (status === "cancelled" || status === "completed" || status === "expired" || status === "halted") {
    return { plan: "free", status: "ended" };
  }
  return { plan: "free", status: "free" };
}
