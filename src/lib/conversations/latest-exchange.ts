import {
  inboxDisplayStatus,
  needsPersonLabel,
  replyNeedsHuman,
  type InboxDisplayStatus,
} from "@/lib/chat/answer-outcome";
import { cutForList } from "@/lib/list-limit";

export type ExchangeMessage = {
  role: string;
  content: string;
  sources?: unknown;
};

/** Messages the owner sees in a thread. SYSTEM turns are hidden everywhere. */
export const VISIBLE_MESSAGE_ROLES = ["USER", "ASSISTANT"] as const;

const QUESTION_PREVIEW_LENGTH = 80;
const REPLY_PREVIEW_LENGTH = 160;

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sourceCount(sources: unknown) {
  return Array.isArray(sources) ? sources.length : 0;
}

/**
 * The newest visitor question and the reply to it.
 * `messagesNewestFirst` must be ordered newest first, like a `desc` query with `take`.
 * A null reply means the visitor is still waiting on the latest question.
 */
export function latestExchange(messagesNewestFirst: ExchangeMessage[]) {
  const visible = messagesNewestFirst.filter(
    (message) => message.role === "USER" || message.role === "ASSISTANT",
  );
  const last = visible[0] ?? null;
  if (!last) return { question: null, reply: null, lastRole: null };

  if (last.role === "USER") {
    return { question: last, reply: null, lastRole: last.role };
  }

  // The reply's question is the newest USER turn before it. It can fall outside
  // the fetched window in a long run of replies, so it may be null.
  const question = visible.find((message) => message.role === "USER") ?? null;
  return { question, reply: last, lastRole: last.role };
}

export type InboxRowPreview = {
  /** The latest question, or null when it is the conversation title already. */
  question: string | null;
  /** What happened to the latest question. */
  reply: string;
};

/** The words for the row's reply. A no-answer reply reads as the case it is. */
function replySummary(reply: ExchangeMessage | null) {
  if (!reply) return "No reply yet";
  if (replyNeedsHuman(reply.content)) return needsPersonLabel(reply.content);
  return cutForList(oneLine(reply.content), REPLY_PREVIEW_LENGTH);
}

/**
 * The inbox row text. The title is the first question, so a later question is
 * named next to its reply. Otherwise the row would pair the first question with
 * the latest reply.
 */
export function inboxRowPreview(input: {
  title: string | null;
  messagesNewestFirst: ExchangeMessage[];
}): InboxRowPreview {
  const { question, reply } = latestExchange(input.messagesNewestFirst);
  if (!question && !reply) return { question: null, reply: "No messages yet" };

  const questionText = question ? oneLine(question.content) : "";
  const title = input.title ? oneLine(input.title) : "";
  const sameAsTitle =
    !questionText ||
    (title.length > 0 && questionText.startsWith(title));

  return {
    question: sameAsTitle ? null : cutForList(questionText, QUESTION_PREVIEW_LENGTH),
    reply: replySummary(reply),
  };
}

/** The status chip, from the same latest exchange the row text shows. */
export function inboxRowStatus(input: {
  messagesNewestFirst: ExchangeMessage[];
  hasOpenTicket: boolean;
}): InboxDisplayStatus {
  const { reply, lastRole } = latestExchange(input.messagesNewestFirst);
  return inboxDisplayStatus({
    lastRole,
    lastAssistantReply: reply?.content ?? null,
    lastAssistantSourceCount: reply ? sourceCount(reply.sources) : 0,
    hasOpenTicket: input.hasOpenTicket,
  });
}
