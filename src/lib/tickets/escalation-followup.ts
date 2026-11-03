import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  triageEscalation,
  type EscalationTriage,
} from "@/lib/tickets/escalation-triage";

/** A slow or hung model must not hold the background step open for long. */
export const AI_TRIAGE_TIMEOUT_MS = 8_000;

export async function triageWithTimeout(
  title: string,
  description: string,
  timeoutMs = AI_TRIAGE_TIMEOUT_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      triageEscalation(title, description),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
    return result === "timeout" ? null : result;
  } catch (error) {
    console.error("Escalation triage error:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs `task` after the response is sent, so the person asking for help is not
 * kept waiting. Outside a request (unit tests, scripts) `after` throws, and the
 * task runs inline instead.
 */
export async function runAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    await task();
  }
}

/**
 * The ticket already holds the keyword triage when this runs. A model triage
 * replaces it only when the model answered; otherwise the keyword one stays.
 */
export async function refineEscalationTriage(input: {
  ticketId: string;
  title: string;
  description: string;
  heuristic: EscalationTriage;
}): Promise<EscalationTriage> {
  const triage = await triageWithTimeout(input.title, input.description);
  if (!triage || triage.source !== "ai") return input.heuristic;

  const applied = await attachTriageIfUntouched(input.ticketId, input.heuristic, triage);
  return applied ? triage : input.heuristic;
}

/**
 * The ticket is visible while the model runs, so a person may already have
 * set its priority. Only a ticket still on the keyword priority is changed.
 */
async function attachTriageIfUntouched(
  ticketId: string,
  heuristic: EscalationTriage,
  triage: EscalationTriage,
) {
  try {
    const { count } = await db.ticket.updateMany({
      where: { id: ticketId, priority: heuristic.priority },
      data: {
        priority: triage.priority,
        triage: triage as Prisma.InputJsonValue,
      },
    });
    return count > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Ticket triage refine failed (non-fatal):", message);
    return false;
  }
}
