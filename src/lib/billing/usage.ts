import type { Prisma } from "@/generated/prisma/client";
import {
  isAtMonthlyCap,
  planForWorkspace,
  startOfUtcMonth,
} from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { RESUME_SCREEN_AUDIT_ACTION } from "@/lib/recruitment/services/audit";

export async function countAssistantAnswersThisMonth(
  organizationId: string,
  now = new Date(),
) {
  return db.message.count({
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
