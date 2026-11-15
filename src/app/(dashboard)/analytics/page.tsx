import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { BoardSwitch } from "@/components/analytics/board-switch";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { isUnansweredEscalation, questionBeforeReply } from "@/lib/chat/answer-outcome";
import { customerChannelFilter, customerConversationWhere } from "@/lib/conversations/filters";
import { db } from "@/lib/db";

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

async function getAnalytics(organizationId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalConversations,
    totalMessages,
    totalTickets,
    openTickets,
    resolvedTickets,
    readyDocuments,
    conversations,
    tickets,
    escalatedConversations,
    resolvedWithTimes,
    statusCounts,
    feedbackStats,
    conversationsByChannel,
  ] = await Promise.all([
    db.conversation.count({
      where: customerConversationWhere(organizationId),
    }),
    db.message.count({
      where: {
        conversation: {
          organizationId,
          ...customerChannelFilter,
        },
      },
    }),
    db.ticket.count({ where: { organizationId } }),
    db.ticket.count({
      where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    db.ticket.count({
      where: { organizationId, status: { in: ["RESOLVED", "CLOSED"] } },
    }),
    db.document.count({
      where: { organizationId, status: "READY" },
    }),
    db.conversation.findMany({
      where: {
        ...customerConversationWhere(organizationId),
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    }),
    db.ticket.findMany({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    db.ticket.findMany({
      where: {
        organizationId,
        title: { startsWith: "Escalation:" },
        conversationId: { not: null },
        conversation: customerChannelFilter,
      },
      select: { conversationId: true },
      distinct: ["conversationId"],
    }),
    db.ticket.findMany({
      where: {
        organizationId,
        resolvedAt: { not: null },
        status: { in: ["RESOLVED", "CLOSED"] },
      },
      select: { createdAt: true, resolvedAt: true },
    }),
    db.ticket.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    }),
    db.message.groupBy({
      by: ["helpful"],
      where: {
        role: "ASSISTANT",
        helpful: { not: null },
        conversation: {
          organizationId,
          ...customerChannelFilter,
        },
      },
      _count: { helpful: true },
    }),
    db.conversation.groupBy({
      by: ["channel"],
      where: customerConversationWhere(organizationId),
      _count: { channel: true },
    }),
  ]);

  const deflectionRate =
    totalConversations === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((totalConversations - escalatedConversations.length) /
                totalConversations) *
                100,
            ),
          ),
        );

  const avgResolutionHours =
    resolvedWithTimes.length === 0
      ? null
      : Math.round(
          resolvedWithTimes.reduce((sum, ticket) => {
            const hours =
              (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) /
              (1000 * 60 * 60);
            return sum + hours;
          }, 0) / resolvedWithTimes.length,
        );

  const dayBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(sevenDaysAgo.getDate() + index);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
      key: localDateKey(date),
      conversations: 0,
      tickets: 0,
    };
  });

  for (const conversation of conversations) {
    const bucket = dayBuckets.find(
      (item) => item.key === localDateKey(conversation.createdAt),
    );
    if (bucket) bucket.conversations += 1;
  }

  for (const ticket of tickets) {
    const bucket = dayBuckets.find(
      (item) => item.key === localDateKey(ticket.createdAt),
    );
    if (bucket) bucket.tickets += 1;
  }

  const escalationTickets = await db.ticket.findMany({
    where: {
      organizationId,
      title: { startsWith: "Escalation:" },
    },
    select: { title: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const gapCounts = new Map<string, number>();

  for (const ticket of escalationTickets) {
    if (!isUnansweredEscalation(ticket.description)) continue;
    const topic = ticket.title.replace(/^Escalation:\s*/i, "").slice(0, 80);
    gapCounts.set(topic, (gapCounts.get(topic) ?? 0) + 1);
  }

  const markedWrong = await db.message.findMany({
    where: {
      role: "ASSISTANT",
      helpful: false,
      conversation: {
        organizationId,
        ...customerChannelFilter,
      },
    },
    select: { conversationId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const wrongConversationIds = [
    ...new Set(markedWrong.map((message) => message.conversationId)),
  ];
  const userTurns = wrongConversationIds.length
    ? await db.message.findMany({
        where: {
          role: "USER",
          conversationId: { in: wrongConversationIds },
        },
        select: { conversationId: true, content: true, createdAt: true },
      })
    : [];

  const wrongCounts = new Map<string, number>();
  for (const message of markedWrong) {
    const topic = questionBeforeReply(
      userTurns.filter((turn) => turn.conversationId === message.conversationId),
      message.createdAt,
    );
    if (!topic) continue;
    wrongCounts.set(topic, (wrongCounts.get(topic) ?? 0) + 1);
  }

  const knowledgeGaps = [
    ...Array.from(gapCounts.entries()).map(([topic, count]) => ({
      topic,
      count,
      kind: "unanswered" as const,
    })),
    ...Array.from(wrongCounts.entries()).map(([topic, count]) => ({
      topic,
      count,
      kind: "marked_wrong" as const,
    })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const helpfulCount =
    feedbackStats.find((item) => item.helpful === true)?._count.helpful ?? 0;
  const notHelpfulCount =
    feedbackStats.find((item) => item.helpful === false)?._count.helpful ?? 0;
  const feedbackCount = helpfulCount + notHelpfulCount;
  const helpfulRate =
    feedbackCount === 0
      ? null
      : Math.round((helpfulCount / feedbackCount) * 100);

  const conversationsByChannelData = conversationsByChannel.map((item) => ({
    channel:
      item.channel === "WIDGET"
        ? "Widget"
        : item.channel === "HELP_CENTER"
          ? "Help center"
          : "Admin",
    count: item._count?.channel ?? 0,
  }));

  return {
    overview: {
      totalConversations,
      totalMessages,
      totalTickets,
      openTickets,
      resolvedTickets,
      readyDocuments,
      deflectionRate,
      avgResolutionHours,
      helpfulRate,
      feedbackCount,
    },
    ticketsByStatus: statusCounts
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => ({
        status: item.status.replace("_", " ").toLowerCase(),
        count: item._count?.status ?? 0,
      })),
    activityByDay: dayBuckets.map(({ date, conversations, tickets }) => ({
      date,
      conversations,
      tickets,
    })),
    knowledgeGaps,
    conversationsByChannel: conversationsByChannelData,
  };
}

export default async function AnalyticsPage() {
  const { organization, role } = await requireOrgMembershipOrRedirect();
  const analytics = await getAnalytics(organization.id);

  return (
    <>
      <Header
        title="Inbox board"
        description="Threads, tickets, and how often a person had to take the case."
      />
      <main id="main-content" className="flex-1 space-y-4 px-4 py-6 sm:p-6 lg:p-8">
        <BoardSwitch current="inbox" />
        <Suspense fallback={<p className="text-sm text-muted">Loading analytics…</p>}>
          <AnalyticsDashboard
            {...analytics}
            canPublishFaq={role === "ADMIN"}
          />
        </Suspense>
      </main>
    </>
  );
}
