import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getDemoOrganizationContext } from "@/lib/auth/demo";
import { ingestUploadedFile } from "@/lib/documents/process";

export async function seedDemoKnowledgeBase() {
  const { organization } = await getDemoOrganizationContext();
  const demoFilePath = path.join(process.cwd(), "demo", "support-faq.txt");
  const content = await readFile(demoFilePath, "utf-8");

  const duplicates = await db.document.findMany({
    where: {
      organizationId: organization.id,
      fileName: "support-faq.txt",
    },
    orderBy: { createdAt: "asc" },
  });

  if (duplicates.length > 1) {
    const [, ...extra] = duplicates;
    await db.document.deleteMany({
      where: { id: { in: extra.map((document) => document.id) } },
    });
  }

  const existing = duplicates[0] ?? null;

  if (existing) {
    const chunks = await db.documentChunk.findMany({
      where: { documentId: existing.id },
      select: { content: true },
    });
    const stored = chunks.map((chunk) => chunk.content).join("\n");
    // The title line changes when the demo FAQ is renamed (it was "SupportAI
    // Demo FAQ"), so an old copy that shares the policy text is still replaced.
    const titleLine = (content.split(/\r?\n/).find((line) => line.trim()) ?? "").trim();
    const marker = "fair-use API limits";
    const matchesCurrentFile =
      stored.includes(titleLine) &&
      (content.includes(marker)
        ? stored.includes(marker)
        : stored.includes(content.slice(0, 80)));

    if (matchesCurrentFile) {
      return { document: existing, created: false };
    }

    await db.documentChunk.deleteMany({ where: { documentId: existing.id } });
    await db.document.delete({ where: { id: existing.id } });
  }

  const file = new File([content], "support-faq.txt", { type: "text/plain" });
  const document = await ingestUploadedFile(organization.id, file);

  return { document, created: true };
}

function refundCitation() {
  return [
    {
      documentTitle: "Refund policy",
      content:
        "Annual plans can be refunded within 14 days of purchase if usage stays under the demo limits. After 14 days, refunds are prorated.",
    },
  ];
}

async function attachRefundCitation(conversationId: string) {
  const replies = await db.message.findMany({
    where: { conversationId, role: "ASSISTANT" },
  });
  for (const reply of replies) {
    if (reply.sources) continue;
    await db.message.update({
      where: { id: reply.id },
      data: { sources: refundCitation() },
    });
  }
}

async function seedDemoConversationsAndTickets(organizationId: string) {
  const marker = await db.conversation.findFirst({
    where: {
      organizationId,
      title: "Demo: Refund question",
    },
  });

  if (marker) {
    await attachRefundCitation(marker.id);
    return { created: false };
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const refundConversation = await db.conversation.create({
    data: {
      organizationId,
      title: "Demo: Refund question",
      channel: "ADMIN",
      createdAt: twoDaysAgo,
      updatedAt: oneDayAgo,
    },
  });

  await db.message.createMany({
    data: [
      {
        conversationId: refundConversation.id,
        role: "USER",
        content: "What is your refund policy for annual plans?",
        createdAt: twoDaysAgo,
      },
      {
        conversationId: refundConversation.id,
        role: "ASSISTANT",
        content:
          "Annual plans can be refunded within 14 days of purchase if usage stays under the demo limits. After 14 days, refunds are prorated.",
        helpful: true,
        sources: refundCitation(),
        createdAt: oneDayAgo,
      },
    ],
  });

  await db.ticket.createMany({
    data: [
      {
        organizationId,
        title: "Billing sync issue",
        description:
          "Customer reports Stripe charges not syncing to the admin dashboard.",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        title: "Password reset emails delayed",
        description: "Multiple users report reset emails arriving after 30 minutes.",
        status: "RESOLVED",
        priority: "LOW",
        resolvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  await db.conversation.create({
    data: {
      organizationId,
      title: "Demo: Help center billing question",
      channel: "HELP_CENTER",
      visitorId: "demo-help-visitor",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
      messages: {
        create: [
          {
            role: "USER",
            content: "Where can I find my invoice in the help center?",
          },
          {
            role: "ASSISTANT",
            content:
              "Invoices are available under Billing in your account settings. I can walk you through the steps.",
            helpful: true,
          },
        ],
      },
    },
  });

  return { created: true };
}

async function seedDemoTriagedEscalation(organizationId: string) {
  const existing = await db.conversation.findFirst({
    where: {
      organizationId,
      title: "Demo: API rate limits",
    },
  });

  if (existing) {
    return { created: false };
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const escalationConversation = await db.conversation.create({
    data: {
      organizationId,
      title: "Demo: API rate limits",
      channel: "WIDGET",
      visitorId: "demo-widget-visitor",
      createdAt: oneDayAgo,
      updatedAt: sixHoursAgo,
    },
  });

  await db.message.createMany({
    data: [
      {
        conversationId: escalationConversation.id,
        role: "USER",
        content: "We keep hitting API rate limits during batch imports.",
        createdAt: oneDayAgo,
      },
      {
        conversationId: escalationConversation.id,
        role: "ASSISTANT",
        content:
          "I found general API limit info, but batch import throttling may need an engineer to review your workspace settings.",
        helpful: false,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
    ],
  });

  await db.ticket.create({
    data: {
      organizationId,
      conversationId: escalationConversation.id,
      title: "Escalation: API rate limits during batch imports",
      description:
        "user: We keep hitting API rate limits during batch imports.\n\nassistant: I found general API limit info, but batch import throttling may need an engineer to review your workspace settings.",
      status: "OPEN",
      priority: "HIGH",
      createdAt: sixHoursAgo,
      triage: {
        priority: "HIGH",
        category: "product",
        reasonCode: "rate_limit_batch_import",
        brief: [
          "Batch import throttling is not covered by the current FAQ.",
          "Ask which workspace and import size triggered the 429s.",
          "Check whether the customer is on Pro API limits before escalating to engineering.",
        ],
        model: "gemini-3.5-flash",
        source: "ai",
      },
    },
  });

  const userMessage = await db.message.findFirst({
    where: {
      conversationId: escalationConversation.id,
      role: "USER",
    },
    orderBy: { createdAt: "asc" },
  });

  if (userMessage) {
    await db.executionRun.create({
      data: {
        workspaceId: organizationId,
        conversationId: escalationConversation.id,
        userMessageId: userMessage.id,
        channel: "WIDGET",
        trigger: "widget_intake",
        createdAt: sixHoursAgo,
        logs: {
          create: [
            {
              workspaceId: organizationId,
              conversationId: escalationConversation.id,
              userMessageId: userMessage.id,
              agent: "lane-router",
              trigger: "widget_intake",
              model: "gemini-3.5-flash",
              decision: "route_to_gemini",
              latencyMs: 18,
              metadata: {
                chunksMatched: 2,
                confidence: 0.42,
                retrievalMode: "keyword",
                seeded: true,
              },
            },
            {
              workspaceId: organizationId,
              conversationId: escalationConversation.id,
              userMessageId: userMessage.id,
              agent: "support-concierge",
              trigger: "widget_intake",
              model: "gemini-3.5-flash",
              decision: "gemini_success",
              latencyMs: 840,
              metadata: {
                provider: "gemini",
                outcome: "needs_human",
                seeded: true,
              },
            },
            {
              workspaceId: organizationId,
              conversationId: escalationConversation.id,
              userMessageId: userMessage.id,
              agent: "escalation-triage",
              trigger: "ticket_update",
              model: "gemini-3.5-flash",
              decision: "triage_ready",
              latencyMs: 310,
              metadata: {
                priority: "HIGH",
                category: "product",
                reasonCode: "rate_limit_batch_import",
                source: "ai",
                seeded: true,
              },
            },
          ],
        },
      },
    });
  }

  return { created: true };
}

async function seedDemoRecruitment(organizationId: string) {
  const demoJobTitle = "Full-Stack Engineer (Demo)";

  let job = await db.job.findFirst({
    where: { organizationId, title: demoJobTitle },
  });

  if (!job) {
    job = await db.job.create({
      data: {
        organizationId,
        title: demoJobTitle,
        description:
          "Build customer-facing SaaS features with Next.js, TypeScript, and PostgreSQL. Own API design, RAG integrations, and polished recruiter/support dashboards.",
        requiredSkills: JSON.stringify([
          "TypeScript",
          "React",
          "Next.js",
          "PostgreSQL",
          "REST APIs",
        ]),
        preferredSkills: JSON.stringify(["Prisma", "PostgreSQL", "RAG"]),
        experienceLevel: "Mid-level",
        minYearsExperience: 2,
        educationRequirements: JSON.stringify(["Bachelor's in CS or equivalent"]),
        certifications: JSON.stringify([]),
        roleType: "Full-time",
      },
    });
  }

  const demoCandidates = [
    {
      displayName: "Alex Rivera",
      status: "shortlisted",
      rawText:
        "Alex Rivera — Full-Stack Engineer with 3 years building React/Next.js SaaS products. Shipped RAG chat features, Prisma/PostgreSQL APIs, and multi-tenant dashboards. Skills: TypeScript, React, Next.js, Node.js, PostgreSQL, Prisma, REST, LLM integrations. BS Computer Science, State University.",
      analysis: {
        summary:
          "Strong full-stack profile with direct Next.js, TypeScript, and PostgreSQL experience plus RAG delivery history.",
        extractedSkills: [
          "TypeScript",
          "React",
          "Next.js",
          "PostgreSQL",
          "Prisma",
          "REST APIs",
          "RAG",
        ],
        matchScore: 88,
        matchRationale:
          "Alex matches all required skills with resume evidence and adds preferred Prisma/RAG experience. Three years aligns with the mid-level bar.",
        missingSkills: [] as string[],
        interviewQuestions: [
          "Walk through the RAG chat feature you shipped — retrieval, grounding, and failure modes.",
          "How did you structure multi-tenant APIs with Prisma and PostgreSQL?",
          "Describe a production Next.js performance issue you resolved.",
        ],
        scoreBreakdown: {
          requiredSkills: 48,
          preferredSkills: 14,
          roleAlignment: 9,
          experience: 9,
          educationCertifications: 8,
          parseQuality: 5,
          penalties: 0,
          matchedRequiredSkills: [
            "TypeScript",
            "React",
            "Next.js",
            "PostgreSQL",
            "REST APIs",
          ],
          matchedPreferredSkills: ["Prisma", "RAG"],
          missingRequiredSkills: [],
          missingPreferredSkills: ["PostgreSQL"],
          requiredSkillEvidence: [
            {
              skill: "TypeScript",
              evidence: "Skills: TypeScript, React, Next.js",
              confidence: 0.95,
              matchType: "exact",
            },
            {
              skill: "React",
              evidence: "3 years building React/Next.js SaaS products",
              confidence: 0.92,
              matchType: "exact",
            },
            {
              skill: "Next.js",
              evidence: "Shipped RAG chat features on Next.js stack",
              confidence: 0.9,
              matchType: "exact",
            },
            {
              skill: "PostgreSQL",
              evidence: "Prisma/PostgreSQL APIs",
              confidence: 0.88,
              matchType: "exact",
            },
            {
              skill: "REST APIs",
              evidence: "Own API design and REST integrations",
              confidence: 0.85,
              matchType: "semantic",
            },
          ],
          preferredSkillEvidence: [
            {
              skill: "Prisma",
              evidence: "Prisma/PostgreSQL APIs",
              confidence: 0.9,
              matchType: "exact",
            },
            {
              skill: "RAG",
              evidence: "Shipped RAG chat features",
              confidence: 0.88,
              matchType: "exact",
            },
          ],
          notes: [
            "Resume shows end-to-end SaaS delivery aligned with full-stack role.",
            "3 years experience meets mid-level requirement.",
          ],
        },
      },
    },
    {
      displayName: "Jordan Kim",
      status: "interviewing",
      rawText:
        "Jordan Kim — Software Engineer, 2.5 years. Built customer dashboards with React and Node REST services on AWS RDS (PostgreSQL). Comfortable with TypeScript and modern React patterns. Limited Next.js exposure; mostly CRA and Vite. No LLM/RAG work yet.",
      analysis: {
        summary:
          "Solid React/TypeScript backend engineer with PostgreSQL experience; lighter on Next.js and no RAG history.",
        extractedSkills: ["TypeScript", "React", "PostgreSQL", "REST APIs", "Node.js"],
        matchScore: 72,
        matchRationale:
          "Jordan covers most core stack requirements but Next.js experience is thin and preferred AI tooling is absent.",
        missingSkills: ["Next.js"],
        interviewQuestions: [
          "What would you need to ramp on Next.js App Router for this role?",
          "Describe your PostgreSQL schema design for a multi-tenant dashboard.",
          "How have you tested and documented REST APIs for frontend teams?",
        ],
        scoreBreakdown: {
          requiredSkills: 38,
          preferredSkills: 4,
          roleAlignment: 7,
          experience: 8,
          educationCertifications: 6,
          parseQuality: 4,
          penalties: 4,
          matchedRequiredSkills: ["TypeScript", "React", "PostgreSQL", "REST APIs"],
          matchedPreferredSkills: [],
          missingRequiredSkills: ["Next.js"],
          missingPreferredSkills: ["Prisma", "PostgreSQL", "RAG"],
          requiredSkillEvidence: [
            {
              skill: "TypeScript",
              evidence: "Comfortable with TypeScript and modern React patterns",
              confidence: 0.9,
              matchType: "exact",
            },
            {
              skill: "React",
              evidence: "Built customer dashboards with React",
              confidence: 0.92,
              matchType: "exact",
            },
            {
              skill: "PostgreSQL",
              evidence: "Node REST services on AWS RDS (PostgreSQL)",
              confidence: 0.86,
              matchType: "semantic",
            },
            {
              skill: "REST APIs",
              evidence: "Node REST services",
              confidence: 0.84,
              matchType: "exact",
            },
          ],
          preferredSkillEvidence: [],
          notes: [
            "Limited Next.js exposure; mostly CRA and Vite.",
            "2.5 years experience is close to the 2-year minimum.",
          ],
        },
      },
    },
    {
      displayName: "Sam Patel",
      status: "new",
      rawText:
        "Sam Patel — Junior developer, 1 year freelance. Built landing pages with React and basic Express APIs. Uses MySQL for side projects. Learning TypeScript. Interested in AI products but no production LLM work.",
      analysis: {
        summary:
          "Early-career frontend-leaning profile with gaps on Next.js, PostgreSQL, and depth of API experience.",
        extractedSkills: ["React", "TypeScript", "REST APIs"],
        matchScore: 54,
        matchRationale:
          "Sam shows React interest and some TypeScript learning but lacks the PostgreSQL/Next.js depth and years of experience for this role.",
        missingSkills: ["Next.js", "PostgreSQL"],
        interviewQuestions: [
          "What production React projects have you shipped end-to-end?",
          "How would you migrate a MySQL side project to PostgreSQL?",
          "Describe the most complex API you have designed so far.",
        ],
        scoreBreakdown: {
          requiredSkills: 22,
          preferredSkills: 0,
          roleAlignment: 5,
          experience: 4,
          educationCertifications: 4,
          parseQuality: 4,
          penalties: 8,
          matchedRequiredSkills: ["React", "TypeScript", "REST APIs"],
          matchedPreferredSkills: [],
          missingRequiredSkills: ["Next.js", "PostgreSQL"],
          missingPreferredSkills: ["Prisma", "PostgreSQL", "RAG"],
          requiredSkillEvidence: [
            {
              skill: "React",
              evidence: "Built landing pages with React",
              confidence: 0.82,
              matchType: "exact",
            },
            {
              skill: "TypeScript",
              evidence: "Learning TypeScript",
              confidence: 0.55,
              matchType: "inferred",
            },
            {
              skill: "REST APIs",
              evidence: "Basic Express APIs",
              confidence: 0.6,
              matchType: "semantic",
            },
          ],
          preferredSkillEvidence: [],
          notes: [
            "Uses MySQL for side projects rather than PostgreSQL.",
            "1 year experience is below the 2-year minimum.",
          ],
        },
      },
    },
    {
      displayName: "Morgan Lee",
      status: "rejected",
      rawText:
        "Morgan Lee — QA engineer transitioning to development. 4 years test automation with Selenium and Cypress. Writes small Python scripts; no professional React or TypeScript delivery. Familiar with SQL reporting queries.",
      analysis: {
        summary:
          "QA background with automation strengths but insufficient application engineering evidence for a full-stack hire.",
        extractedSkills: ["SQL", "Cypress", "Selenium", "Python"],
        matchScore: 38,
        matchRationale:
          "Morgan lacks demonstrated React, Next.js, TypeScript, and REST API ownership required for this opening.",
        missingSkills: ["TypeScript", "React", "Next.js", "PostgreSQL", "REST APIs"],
        interviewQuestions: [
          "Have you contributed production frontend code outside test automation?",
          "What would your 90-day plan look like to reach full-stack competency?",
        ],
        scoreBreakdown: {
          requiredSkills: 8,
          preferredSkills: 0,
          roleAlignment: 3,
          experience: 5,
          educationCertifications: 3,
          parseQuality: 4,
          penalties: 12,
          matchedRequiredSkills: [],
          matchedPreferredSkills: [],
          missingRequiredSkills: [
            "TypeScript",
            "React",
            "Next.js",
            "PostgreSQL",
            "REST APIs",
          ],
          missingPreferredSkills: ["Prisma", "PostgreSQL", "RAG"],
          requiredSkillEvidence: [],
          preferredSkillEvidence: [],
          notes: [
            "QA engineer profile; no professional React or TypeScript delivery cited.",
            "Familiar with SQL reporting but not PostgreSQL application development.",
          ],
        },
      },
    },
  ];

  let createdCount = 0;

  for (const demo of demoCandidates) {
    const existingCandidate = await db.candidate.findFirst({
      where: { jobId: job.id, displayName: demo.displayName },
      include: { analysis: true },
    });

    if (existingCandidate?.analysis) {
      continue;
    }

    if (existingCandidate) {
      await db.candidateAnalysis.create({
        data: {
          candidateId: existingCandidate.id,
          summary: demo.analysis.summary,
          extractedSkills: JSON.stringify(demo.analysis.extractedSkills),
          matchScore: demo.analysis.matchScore,
          scoreBreakdown: JSON.stringify(demo.analysis.scoreBreakdown),
          matchRationale: demo.analysis.matchRationale,
          missingSkills: JSON.stringify(demo.analysis.missingSkills),
          interviewQuestions: JSON.stringify(demo.analysis.interviewQuestions),
          modelId: "demo-seed",
        },
      });
      createdCount += 1;
      continue;
    }

    await db.candidate.create({
      data: {
        jobId: job.id,
        displayName: demo.displayName,
        rawText: demo.rawText,
        parseStatus: "manual",
        status: demo.status,
        filePath: null,
        analysis: {
          create: {
            summary: demo.analysis.summary,
            extractedSkills: JSON.stringify(demo.analysis.extractedSkills),
            matchScore: demo.analysis.matchScore,
            scoreBreakdown: JSON.stringify(demo.analysis.scoreBreakdown),
            matchRationale: demo.analysis.matchRationale,
            missingSkills: JSON.stringify(demo.analysis.missingSkills),
            interviewQuestions: JSON.stringify(demo.analysis.interviewQuestions),
            modelId: "demo-seed",
          },
        },
      },
    });
    createdCount += 1;
  }

  return { created: createdCount > 0, jobId: job.id };
}

export async function seedDemoWorkspace() {
  const knowledge = await seedDemoKnowledgeBase();
  const { organization } = await getDemoOrganizationContext();
  const workspace = await seedDemoConversationsAndTickets(organization.id);
  const triaged = await seedDemoTriagedEscalation(organization.id);
  const recruitment = await seedDemoRecruitment(organization.id);

  return {
    document: knowledge.document,
    knowledgeCreated: knowledge.created,
    workspaceCreated: workspace.created || triaged.created,
    recruitmentCreated: recruitment.created,
    recruitmentJobId: recruitment.jobId,
  };
}

export async function getWorkspaceHealth(organizationId: string) {
  const [readyDocuments, conversations, openTickets] = await Promise.all([
    db.document.count({
      where: { organizationId, status: "READY" },
    }),
    db.conversation.count({ where: { organizationId } }),
    db.ticket.count({
      where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  return { readyDocuments, conversations, openTickets };
}
