import type { Prisma } from "@/generated/prisma/client";
import {
  isAtMonthlyCap,
  planForWorkspace,
  startOfUtcMonth,
} from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { RESUME_SCREEN_AUDIT_ACTION } from "@/lib/recruitment/services/audit";

type MessageCounter = Pick<Prisma.TransactionClient, "message">;

export async function countAssistantAnswersThisMonth(
  organizationId: string,
  now = new Date(),
  client: MessageCounter = db,
) {
  return client.message.count({
    where: {
      role: "USER",
      createdAt: { gte: startOfUtcMonth(now) },
      conversation: { organizationId },
    },
  });
}

export async function countResumeScreensThisMonth(
  organizationId: string,
  now = new Date(),
) {
  const monthStart = startOfUtcMonth(now);

  // Analyses are deleted by resume edits, job edits, and candidate removal.
  // The audit log keeps those screens used. It is written best effort, so the
  // live analyses are the floor.
  const [screenEvents, liveAnalyses] = await Promise.all([
    db.recruitmentAuditEvent.count({
      where: {
        organizationId,
        action: RESUME_SCREEN_AUDIT_ACTION,
        createdAt: { gte: monthStart },
      },
    }),
    db.candidateAnalysis.count({
      where: {
        analyzedAt: { gte: monthStart },
        candidate: { job: { organizationId } },
      },
    }),
  ]);

  return Math.max(screenEvents, liveAnalyses);
}

type RoleCounter = Pick<Prisma.TransactionClient, "job">;

export async function countRoles(organizationId: string, client: RoleCounter = db) {
  return client.job.count({ where: { organizationId } });
}

export async function assistantAnswersCapped(organizationId: string) {
  const plan = planForWorkspace({ publicDemo: isPublicDemoMode() });
  if (!plan) return false;

  const used = await countAssistantAnswersThisMonth(organizationId);
  return isAtMonthlyCap(used, plan.assistantAnswersPerMonth);
}

/**
 * Runs `write`, which must store the turn's USER message through `tx`, only if
 * the workspace is under its monthly cap. Returns null when it is not.
 *
 * The lock is per workspace, so parallel turns cannot all read the same count
 * and pass, as in createJobWithinCap. It lasts only for this transaction: keep
 * retrieval and the model out of `write`, or every visitor waits on the model.
 */
export async function claimAnswerWithinCap<T>(
  organizationId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T | null> {
  const plan = planForWorkspace({ publicDemo: isPublicDemoMode() });

  return db.$transaction(
    async (tx) => {
      if (!plan) return write(tx);

      const lockKey = `answer-cap:${organizationId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))`;

      const used = await countAssistantAnswersThisMonth(organizationId, new Date(), tx);
      if (isAtMonthlyCap(used, plan.assistantAnswersPerMonth)) return null;

      return write(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export async function resumeScreensCapped(organizationId: string) {
  const plan = planForWorkspace({ publicDemo: isPublicDemoMode() });
  if (!plan) return false;

  const used = await countResumeScreensThisMonth(organizationId);
  return isAtMonthlyCap(used, plan.resumeScreensPerMonth);
}

export async function rolesCapped(organizationId: string, client: RoleCounter = db) {
  const plan = planForWorkspace({ publicDemo: isPublicDemoMode() });
  if (!plan) return false;

  const used = await countRoles(organizationId, client);
  return isAtMonthlyCap(used, plan.roles);
}
