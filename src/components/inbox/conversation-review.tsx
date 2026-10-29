import Link from "next/link";
import { ArrowLeft, Bot, FileText, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  inboxDisplayMeta,
  inboxDisplayStatus,
  questionBeforeReply,
  widgetAnswerState,
} from "@/lib/chat/answer-outcome";

function sourcePassages(sources: unknown) {
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const record = source as { documentTitle?: unknown; content?: unknown };
    const title =
      typeof record.documentTitle === "string" && record.documentTitle.trim()
        ? record.documentTitle.trim()
        : "Document";
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!content && title === "Document") return [];
    return [{ title, content }];
  });
}

type ReviewMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  helpful: boolean | null;
  sources?: unknown;
};

type ConversationReviewProps = {
  conversation: {
    id: string;
    title: string | null;
    channel: string;
    updatedAt: Date;
    messages: ReviewMessage[];
    tickets: Array<{ id: string; status: string }>;
  };
};

export function ConversationReview({ conversation }: ConversationReviewProps) {
  // Same rule as the inbox list: any open ticket means a person has the case.
  const openTicket = conversation.tickets.find(
    (ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS",
  );
  const linkedTicket = openTicket ?? conversation.tickets[0];
  const visibleMessages = conversation.messages.filter(
    (message) => message.role === "USER" || message.role === "ASSISTANT",
  );
  const lastMessage = visibleMessages.at(-1);
  const lastAssistant = [...visibleMessages]
    .reverse()
    .find((message) => message.role === "ASSISTANT");
  const status = inboxDisplayStatus({
    lastRole: lastMessage?.role ?? null,
    lastAssistantReply: lastAssistant?.content ?? null,
    lastAssistantSourceCount: lastAssistant
      ? sourcePassages(lastAssistant.sources).length
      : 0,
    hasOpenTicket: Boolean(openTicket),
  });
  const statusMeta = inboxDisplayMeta(status);
  const userTurns = visibleMessages
    .filter((message) => message.role === "USER")
    .map((message) => ({ content: message.content, createdAt: message.createdAt }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/inbox"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">
            {conversation.channel === "HELP_CENTER" ? "Help center" : "Site chat"}
          </Badge>
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {conversation.title ?? "Customer conversation"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Read-only transcript · updated{" "}
            <RelativeTime date={conversation.updatedAt} />
          </p>
        </div>

        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto px-6 py-5">
          {visibleMessages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages in this conversation.</p>
          ) : (
            visibleMessages.map((message) => {
              const isUser = message.role === "USER";
              const passages = isUser ? [] : sourcePassages(message.sources);
              const answerState = isUser
                ? null
                : widgetAnswerState({
                    reply: message.content,
                    sourceCount: passages.length,
                  });
              const question = isUser
                ? ""
                : questionBeforeReply(userTurns, message.createdAt);
              const canDraft =
                !isUser &&
                question.length > 0 &&
                (answerState === "needs_person" || message.helpful === false);
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isUser ? "bg-slate-100 text-slate-600" : "bg-primary-soft text-primary"
                    }`}
                  >
                    {isUser ? (
                      <UserRound className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      isUser
                        ? "bg-slate-100 text-slate-800"
                        : "bg-primary-soft/50 text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {answerState ? (
                      <p
                        className={`mt-2 text-xs font-medium ${
                          answerState === "from_docs" ? "text-accent" : "text-amber-800"
                        }`}
                      >
                        {answerState === "from_docs"
                          ? "Answered from your docs"
                          : "Not in your docs. A person can take this."}
                      </p>
                    ) : null}
                    {passages.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                        {passages.map((passage, index) => (
                          <li key={`${message.id}-${index}`}>
                            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                              <FileText className="h-3.5 w-3.5" />
                              {passage.title}
                            </p>
                            {passage.content ? (
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {passage.content.length > 320
                                  ? `${passage.content.slice(0, 320)}…`
                                  : passage.content}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {message.helpful !== null ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Marked {message.helpful ? "helpful" : "not helpful"}
                      </p>
                    ) : null}
                    {canDraft ? (
                      <Link
                        href={`/analytics?gap=${encodeURIComponent(question)}#knowledge-gaps`}
                        className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                      >
                        Draft a page from this question
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <p className="text-sm text-slate-500">
            Read the passage under the reply. When the docs do not cover the
            question, draft a page or open the case.
          </p>
          {linkedTicket ? (
            <Link
              href={`/tickets/${linkedTicket.id}`}
              className={buttonClassName({ size: "sm" })}
            >
              Open the case
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
