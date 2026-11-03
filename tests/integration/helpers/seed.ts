import { randomUUID } from "node:crypto";
import { generateWidgetPublicKey } from "@/lib/auth/demo";
import { db } from "@/lib/db";
import type { Actor } from "./session";

export const CANARY_PREFIX = "CANARY";

/** Words both knowledge bases share, so a search can match either workspace. */
export const SHARED_QUERY = "zebra warranty refund";

/** Used by both workspaces, to prove the org check holds on its own. */
const SHARED_VISITOR_ID = "11111111-1111-4111-8111-111111111111";

const SLUG_PREFIX = "canary-tenant-";
const CLERK_PREFIX = "user_canary_";

export type Tenant = Awaited<ReturnType<typeof seedTenant>>;

async function seedTenant(label: "A" | "B") {
  const canary = (name: string) => `${CANARY_PREFIX}-${label}-${name}`;
  const lower = label.toLowerCase();

  const admin: Actor = {
    userId: `${CLERK_PREFIX}${lower}_admin`,
    email: `admin-${lower}@canary.example.test`,
    orgId: `org_canary_${lower}`,
    orgRole: "org:admin",
  };
  const agent: Actor = {
    ...admin,
    userId: `${CLERK_PREFIX}${lower}_agent`,
    email: `agent-${lower}@canary.example.test`,
    orgRole: "org:member",
  };

  const origin = `https://${lower}.example.test`;
  const widgetKey = generateWidgetPublicKey();

  const organization = await db.organization.create({
    data: {
      name: canary("org-name"),
      slug: `${SLUG_PREFIX}${lower}`,
      clerkOrgId: admin.orgId,
      widgetPublicKey: widgetKey,
      settings: {
        greeting: canary("greeting"),
        tone: "friendly",
        instructions: canary("instructions"),
        widget: { allowedOrigins: [origin] },
      },
    },
  });

  const user = await db.user.create({
    data: {
      clerkUserId: admin.userId,
      email: admin.email,
      name: canary("admin-name"),
      memberships: { create: { organizationId: organization.id, role: "ADMIN" } },
    },
  });

  const document = await db.document.create({
    data: {
      organizationId: organization.id,
      title: canary("document"),
      fileName: `${canary("document")}.md`,
      fileType: "text/markdown",
      fileSize: 64,
      status: "READY",
      chunkCount: 1,
      chunks: {
        create: {
          chunkIndex: 0,
          content: `${canary("chunk")} ${SHARED_QUERY} policy for this workspace.`,
          tokenCount: 12,
          embedding: label === "A" ? [1, 0, 0] : [0, 1, 0],
        },
      },
    },
    include: { chunks: true },
  });

  const conversation = await db.conversation.create({
    data: {
      organizationId: organization.id,
      channel: "ADMIN",
      title: canary("conversation"),
      messages: {
        create: [
          { role: "USER", content: canary("user-message") },
          { role: "ASSISTANT", content: canary("assistant-message") },
        ],
      },
    },
    include: { messages: true },
  });

  const visitorId = SHARED_VISITOR_ID;
  const widgetConversation = await db.conversation.create({
    data: {
      organizationId: organization.id,
      channel: "WIDGET",
      visitorId,
      title: canary("widget-conversation"),
      messages: {
        create: [
          { role: "USER", content: canary("widget-user-message") },
          { role: "ASSISTANT", content: canary("widget-assistant-message") },
        ],
      },
    },
    include: { messages: true },
  });

  const otherVisitorId = randomUUID();
  const otherVisitorConversation = await db.conversation.create({
    data: {
      organizationId: organization.id,
      channel: "WIDGET",
      visitorId: otherVisitorId,
      title: canary("other-visitor-conversation"),
      messages: {
        create: [{ role: "ASSISTANT", content: canary("other-visitor-message") }],
      },
    },
    include: { messages: true },
  });

  const ticket = await db.ticket.create({
    data: {
      organizationId: organization.id,
      conversationId: conversation.id,
      title: `Escalation: ${canary("ticket")}`,
      description: canary("ticket-description"),
      requesterEmail: `requester-${lower}@canary.example.test`,
      requesterName: canary("requester"),
      comments: { create: { authorId: user.id, content: canary("comment") } },
    },
  });

  const job = await db.job.create({
    data: {
      organizationId: organization.id,
      title: canary("job"),
      description: `${canary("job-description")} for a fictional role in this test.`,
      requiredSkills: JSON.stringify([canary("skill")]),
      clientName: canary("client"),
      shareToken: canary("share-token"),
    },
  });

  const candidate = await db.candidate.create({
    data: {
      jobId: job.id,
      displayName: canary("candidate"),
      fileName: `${canary("resume")}.pdf`,
      mimeType: "application/pdf",
      filePath: "stored",
      fileBytes: new Uint8Array(Buffer.from(`%PDF-1.4 ${canary("file-bytes")}`)),
      rawText: `${canary("resume-text")} ${"Ten years of fictional experience. ".repeat(3)}`,
      status: "shortlisted",
      notes: canary("candidate-notes"),
      analysis: {
        create: {
          summary: canary("analysis"),
          extractedSkills: JSON.stringify([canary("skill")]),
          matchScore: 80,
          matchRationale: canary("rationale"),
          missingSkills: "[]",
          interviewQuestions: JSON.stringify([canary("question")]),
        },
      },
    },
  });

  // A hire still inside its undo window, so undo and finalize have work to do.
  const hired = await db.candidate.create({
    data: {
      jobId: job.id,
      displayName: canary("hired"),
      rawText: canary("hired-resume-text"),
      status: "hired",
    },
  });
  const archived = await db.candidate.create({
    data: {
      jobId: job.id,
      displayName: canary("archived"),
      rawText: canary("archived-resume-text"),
      status: "archived",
      statusBeforeArchive: "new",
    },
  });
  await db.job.update({
    where: { id: job.id },
    data: {
      pendingHireCandidateId: hired.id,
      pendingHireExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pendingHirePreviousStatus: "interviewing",
    },
  });

  const auditEvent = await db.recruitmentAuditEvent.create({
    data: {
      organizationId: organization.id,
      action: "job.update",
      entityType: "job",
      entityId: job.id,
      metadata: JSON.stringify({ jobId: job.id, note: canary("audit") }),
    },
  });

  const executionRun = await db.executionRun.create({
    data: {
      workspaceId: organization.id,
      conversationId: widgetConversation.id,
      userMessageId: widgetConversation.messages[0].id,
      channel: "WIDGET",
      trigger: "widget_intake",
      logs: {
        create: {
          workspaceId: organization.id,
          conversationId: widgetConversation.id,
          agent: "lane-router",
          trigger: "widget_intake",
          model: "N/A",
          decision: canary("execution-decision"),
        },
      },
    },
  });

  return {
    label,
    admin,
    agent,
    origin,
    widgetKey,
    organization,
    user,
    document,
    chunk: document.chunks[0],
    conversation,
    message: conversation.messages.find((row) => row.role === "ASSISTANT")!,
    visitorId,
    widgetConversation,
    widgetMessage: widgetConversation.messages.find((row) => row.role === "ASSISTANT")!,
    otherVisitorId,
    otherVisitorConversation,
    otherVisitorMessage: otherVisitorConversation.messages[0],
    ticket,
    job,
    candidate,
    hired,
    archived,
    auditEvent,
    executionRun,
  };
}

/** Removes only what this suite made, so a developer's other local rows survive. */
export async function removeTenants() {
  const organizations = await db.organization.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true },
  });
  const workspaceIds = organizations.map((organization) => organization.id);

  // ExecutionRun has no foreign key to Organization, so it does not cascade.
  await db.executionRun.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
  await db.organization.deleteMany({ where: { id: { in: workspaceIds } } });
  await db.user.deleteMany({ where: { clerkUserId: { startsWith: CLERK_PREFIX } } });
}

export async function seedTenants() {
  await removeTenants();
  const a = await seedTenant("A");
  const b = await seedTenant("B");
  return { a, b };
}

/** Every row a workspace owns, in a stable order, including each row's updatedAt. */
export async function snapshotTenant(tenant: Tenant) {
  const organizationId = tenant.organization.id;
  const byId = { orderBy: { id: "asc" } } as const;
  const inJob = { job: { organizationId } };

  const [
    organization,
    members,
    documents,
    chunks,
    conversations,
    messages,
    tickets,
    comments,
    jobs,
    candidates,
    analyses,
    auditEvents,
    executionRuns,
    executionLogs,
  ] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId } }),
    db.organizationMember.findMany({ where: { organizationId }, ...byId }),
    db.document.findMany({ where: { organizationId }, ...byId }),
    db.documentChunk.findMany({ where: { document: { organizationId } }, ...byId }),
    db.conversation.findMany({ where: { organizationId }, ...byId }),
    db.message.findMany({ where: { conversation: { organizationId } }, ...byId }),
    db.ticket.findMany({ where: { organizationId }, ...byId }),
    db.ticketComment.findMany({ where: { ticket: { organizationId } }, ...byId }),
    db.job.findMany({ where: { organizationId }, ...byId }),
    db.candidate.findMany({ where: inJob, ...byId }),
    db.candidateAnalysis.findMany({ where: { candidate: inJob }, ...byId }),
    db.recruitmentAuditEvent.findMany({ where: { organizationId }, ...byId }),
    db.executionRun.findMany({ where: { workspaceId: organizationId }, ...byId }),
    db.executionLogEntry.findMany({ where: { workspaceId: organizationId }, ...byId }),
  ]);

  return {
    organization,
    members,
    documents,
    chunks,
    conversations,
    messages,
    tickets,
    comments,
    jobs,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      fileBytes: candidate.fileBytes
        ? Buffer.from(candidate.fileBytes).toString("hex")
        : null,
    })),
    analyses,
    auditEvents,
    executionRuns,
    executionLogs,
  };
}
