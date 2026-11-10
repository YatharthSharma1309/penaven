import type { CandidateDTO } from "@/lib/recruitment/types";

type OrderableCandidate = Pick<CandidateDTO, "createdAt" | "review">;

/** Required skills marked Contradicts on this resume. */
export function contradictionCount(candidate: Pick<CandidateDTO, "review">): number {
  return (
    candidate.review?.requirements.filter((row) => row.verdict === "contradictory").length ?? 0
  );
}

function createdAtMs(candidate: OrderableCandidate): number {
  const ms = new Date(candidate.createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Default candidate order. The match percentage is shown but never used as the key:
 * it is criteria alignment, not a ranking. Most must-haves addressed first, then
 * fewer Contradicts, then newest. Candidates without a review go last.
 */
export function compareByMustHaves(a: OrderableCandidate, b: OrderableCandidate): number {
  if (a.review && !b.review) return -1;
  if (!a.review && b.review) return 1;
  if (a.review && b.review) {
    const shown = b.review.matchedRequiredCount - a.review.matchedRequiredCount;
    if (shown !== 0) return shown;
    const contradicts = contradictionCount(a) - contradictionCount(b);
    if (contradicts !== 0) return contradicts;
  }
  return createdAtMs(b) - createdAtMs(a);
}

export function orderByMustHaves<T extends OrderableCandidate>(candidates: T[]): T[] {
  return [...candidates].sort(compareByMustHaves);
}

/**
 * The candidate a job card highlights: first in the default order, and only when
 * they have at least one must-have addressed. Null when nobody qualifies.
 */
export function pickMostMustHavesShown<T extends OrderableCandidate>(candidates: T[]): T | null {
  const first = orderByMustHaves(candidates.filter((candidate) => candidate.review))[0];
  if (!first?.review || first.review.matchedRequiredCount === 0) return null;
  return first;
}
