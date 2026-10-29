const UNANSWERED_REPLY =
  /don'?t have (enough )?information|do not have enough|not in (my |the |your )?knowledge|could not find|couldn'?t find|no relevant (information|documentation)|unable to (answer|find)/i;

export function replyNeedsHuman(reply: string) {
  return UNANSWERED_REPLY.test(reply);
}

export function supportRunOutcome(input: {
  chunksMatched: number;
  confidence: "high" | "medium" | "low";
  reply: string;
}) {
  if (input.chunksMatched === 0 || replyNeedsHuman(input.reply)) {
    return input.chunksMatched === 0 ? "low_knowledge" : "needs_human";
  }
  if (input.confidence === "low") return "low_confidence";
  return "deflected";
}

export function lastAssistantReply(transcript: string) {
  const turns = transcript
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => /^assistant:/i.test(part));

  const last = turns.at(-1);
  if (!last) return null;
  return last.replace(/^assistant:\s*/i, "").trim();
}

export function isUnansweredEscalation(description: string) {
  const reply = lastAssistantReply(description);
  if (!reply) return true;
  return replyNeedsHuman(reply);
}

export type WidgetAnswerState = "from_docs" | "needs_person";

/** What the widget should say. Empty replies stay unlabeled while the stream is still arriving. */
export function widgetAnswerState(input: {
  reply: string;
  sourceCount: number;
  retrievalMode?: string | null;
}): WidgetAnswerState | null {
  if (!input.reply.trim()) return null;
  if (input.retrievalMode === "monthly_cap") return "needs_person";
  if (replyNeedsHuman(input.reply)) return "needs_person";
  if (input.sourceCount === 0) return "needs_person";
  return "from_docs";
}

export type InboxThreadLabel = "waiting" | "answered";

export type InboxDisplayStatus = "open" | "waiting_for_human" | "answered";

const inboxDisplayCopy: Record<
  InboxDisplayStatus,
  { label: string; tone: "info" | "warning" | "success" }
> = {
  open: { label: "Open", tone: "info" },
  waiting_for_human: { label: "Waiting for a human", tone: "warning" },
  answered: { label: "Answered", tone: "success" },
};

/** Visible inbox state. Answered means the docs covered the last reply. It is not a closed case. */
export function inboxDisplayStatus(input: {
  lastRole: string | null;
  lastAssistantReply: string | null;
  hasOpenTicket: boolean;
}): InboxDisplayStatus {
  if (input.hasOpenTicket) return "waiting_for_human";
  if (inboxThreadLabel(input) === "waiting") return "open";
  return "answered";
}

export function inboxDisplayMeta(status: InboxDisplayStatus) {
  return inboxDisplayCopy[status];
}

export function inboxThreadLabel(input: {
  lastRole: string | null;
  lastAssistantReply: string | null;
  hasOpenTicket: boolean;
}): InboxThreadLabel {
  if (input.hasOpenTicket) return "waiting";
  if (input.lastRole === "USER") return "waiting";
  if (input.lastAssistantReply && replyNeedsHuman(input.lastAssistantReply)) {
    return "waiting";
  }
  return "answered";
}

export function questionBeforeReply(
  userTurns: Array<{ content: string; createdAt: Date }>,
  replyAt: Date,
) {
  const replyTime = replyAt.getTime();
  const prior = userTurns
    .filter((turn) => turn.createdAt.getTime() <= replyTime)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

  return prior?.content.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
}
