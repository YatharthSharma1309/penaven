import {
  isAtMonthlyCap,
  planForWorkspace,
  startOfUtcMonth,
} from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { isPublicDemoMode } from "@/lib/env/public-demo";

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
  return db.candidateAnalysis.count({
    where: {
      analyzedAt: { gte: startOfUtcMonth(now) },
      candidate: { job: { organizationId } },
    },
  });
}

export async function countRoles(organizationId: string) {
  return db.job.count({ where: { organizationId } });
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

export async function rolesCapped(organizationId: string) {
  const plan = planForWorkspace({ publicDemo: isPublicDemoMode() });
  if (!plan) return false;

  const used = await countRoles(organizationId);
  return isAtMonthlyCap(used, plan.roles);
}
