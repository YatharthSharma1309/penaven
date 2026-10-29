import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { inboxDisplayMeta, inboxDisplayStatus } from "@/lib/chat/answer-outcome";
import { customerConversationWhere } from "@/lib/conversations/filters";
import { db } from "@/lib/db";
import { RelativeTime } from "@/components/ui/relative-time";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";

const inboxFilters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "waiting_for_human", label: "Waiting for a human" },
  { id: "answered", label: "Answered" },
] as const;

type InboxFilter = (typeof inboxFilters)[number]["id"];

function parseInboxFilter(value: string | undefined): InboxFilter {
  if (
    value === "open" ||
    value === "waiting_for_human" ||
    value === "answered"
  ) {
    return value;
  }
  return "all";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = parseInboxFilter(status);
  const { organization } = await requireOrgMembershipOrRedirect();

  const conversations = await db.conversation.findMany({
    where: customerConversationWhere(organization.id),
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { role: true, content: true, sources: true },
      },
      tickets: {
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <Header
        title="Inbox"
        description="Customer conversations in one list. Open means a reply is still needed. Waiting for a human means a case is already with you. Answered means the last reply came from your docs."
      />

      <main id="main-content" className="flex-1 px-4 py-6 sm:p-6 lg:p-8">
        {conversations.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No threads yet"
            description="Threads show up here once someone uses the website chat."
          />
        ) : (
          <InboxList conversations={conversations} filter={filter} />
        )}
      </main>
    </>
  );
}

function InboxList({
  conversations,
  filter,
}: {
  conversations: Array<{
    id: string;
    title: string | null;
    updatedAt: Date;
    messages: Array<{ role: string; content: string; sources: unknown }>;
    tickets: Array<{ id: string; status: string }>;
  }>;
  filter: InboxFilter;
}) {
  const rows = conversations.map((conversation) => {
    const lastMessage = conversation.messages[0];
    const lastAssistant = conversation.messages.find(
      (message) => message.role === "ASSISTANT",
    );
    const openTicket = conversation.tickets.find(
      (ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS",
    );
    const linkedTicket = openTicket ?? conversation.tickets[0];
    const status = inboxDisplayStatus({
      lastRole: lastMessage?.role ?? null,
      lastAssistantReply: lastAssistant?.content ?? null,
      lastAssistantSourceCount: Array.isArray(lastAssistant?.sources)
        ? lastAssistant.sources.length
        : 0,
      hasOpenTicket: Boolean(openTicket),
    });
    return { conversation, lastMessage, linkedTicket, status };
  });
  const visible = rows.filter((row) => filter === "all" || row.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Inbox status">
        {inboxFilters.map((item) => {
          const count =
            item.id === "all"
              ? rows.length
              : rows.filter((row) => row.status === item.id).length;
          const active = filter === item.id;
          const href = item.id === "all" ? "/inbox" : `/inbox?status=${item.id}`;
          return (
            <Link
              key={item.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                active
                  ? "bg-primary text-white ring-primary"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-primary-soft hover:text-primary"
              }`}
            >
              {item.label}
              <span className={active ? "text-white/80" : "text-slate-400"}>
                {" "}
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing in this status"
          description="Try another status, or open All to see every conversation."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {visible.map(({ conversation, lastMessage, linkedTicket, status }) => {
            const meta = inboxDisplayMeta(status);
            const preview = lastMessage ? lastMessage.content : "No messages yet";

              return (
                <li key={conversation.id}>
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                    <Link href={`/inbox/${conversation.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {conversation.title ?? "Support chat"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">{preview}</p>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-xs text-slate-500">
                        <RelativeTime date={conversation.updatedAt} />
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {linkedTicket ? (
                        <Link
                          href={`/tickets/${linkedTicket.id}`}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Open case
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
          })}
        </ul>
      )}
    </div>
  );
}
