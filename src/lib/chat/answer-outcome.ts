import { isPublicDemoMode } from "@/lib/env/public-demo";

const UNANSWERED_REPLY =
  /don'?t have (enough )?information|do not have enough|not in (my |the |your )?knowledge|could not find|couldn'?t find|no relevant (information|documentation)|unable to (answer|find)/i;

export function replyNeedsHuman(reply: string) {
  return UNANSWERED_REPLY.test(reply);
}

export type ChatChannel = "ADMIN" | "WIDGET" | "HELP_CENTER";

/**
 * Who reads the chat. Staff are the business owner and their team (admin chat,
 * inbox, run log). Visitors are the business's customers on the widget or the
 * help center, so their copy never mentions docs, a knowledge base, or tickets.
 */
export type ChatAudience = "staff" | "visitor";

export function chatAudience(channel: ChatChannel | "SANDBOX"): ChatAudience {
  return channel === "WIDGET" || channel === "HELP_CENTER" ? "visitor" : "staff";
}

/** How a visitor reaches a person. The public demo keeps no email, so it asks for none. */
export function visitorHandoffStep() {
  return isPublicDemoMode()
    ? "Choose Ask a person to take this."
    : "Add your email and choose Ask a person to take this.";
}

// Must stay matched by UNANSWERED_REPLY, so this reply is never a good answer.
const AI_UNAVAILABLE_LEAD = "I'm unable to answer this right now.";

/** The reply when docs matched but no model answered. It must not quote the docs. */
export function aiUnavailableReply(channel: ChatChannel | "SANDBOX") {
  // The settings sandbox has no handoff button to point at.
  if (channel === "SANDBOX") return `${AI_UNAVAILABLE_LEAD} A person can still help.`;
  if (chatAudience(channel) === "visitor") {
    return `${AI_UNAVAILABLE_LEAD} A person can still help. ${visitorHandoffStep()}`;
  }
  return `${AI_UNAVAILABLE_LEAD} A person can still help — choose Hand this to a person.`;
}

export function isAiUnavailableReply(reply: string) {
  return reply.startsWith(AI_UNAVAILABLE_LEAD);
}

/** The reply when no doc matched. Must stay matched by UNANSWERED_REPLY. */
export function noMatchReply(channel: ChatChannel | "SANDBOX") {
  if (chatAudience(channel) === "visitor") {
    return `Sorry, I couldn't find an answer to that. A person can pick this up. ${visitorHandoffStep()}`;
  }
  return "I could not find relevant information in your knowledge base. Try uploading FAQs or escalate to a support ticket.";
}

type AnswerCopy = {
  fromDocs: string;
  sourcesHeading: string;
  notInDocs: string;
  personCanHelp: string;
};

const ANSWER_COPY: Record<ChatAudience, AnswerCopy> = {
  staff: {
    fromDocs: "Answered from your docs",
    sourcesHeading: "From your docs",
    notInDocs: "Not in your docs. A person can take this.",
    personCanHelp: "A person can take this.",
  },
  visitor: {
    fromDocs: "From our help pages",
    sourcesHeading: "Sources",
    notInDocs: "I don't have that in our help pages. A person can pick this up.",
    personCanHelp: "A person can pick this up.",
  },
};

/** Labels under an assistant reply. Staff copy is for the owner, visitor copy for their customers. */
export function answerOutcomeCopy(audience: ChatAudience = "staff") {
  return ANSWER_COPY[audience];
}

/** The docs may cover an unavailable reply, so only the other case says they do not. */
export function needsPersonLabel(reply: string, audience: ChatAudience = "staff") {
  const copy = ANSWER_COPY[audience];
  return isAiUnavailableReply(reply) ? copy.personCanHelp : copy.notInDocs;
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
  /** Sources cited by the last reply; 0 means it did not come from the docs. */
  lastAssistantSourceCount?: number;
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
  lastAssistantSourceCount?: number;
  hasOpenTicket: boolean;
}): InboxThreadLabel {
  if (input.hasOpenTicket) return "waiting";
  if (input.lastRole === "USER") return "waiting";
  if (input.lastAssistantReply && replyNeedsHuman(input.lastAssistantReply)) {
    return "waiting";
  }
  // Same rule as widgetAnswerState: a reply with no cited source (e.g. the
  // monthly-cap reply) is not an answer from the docs.
  if (input.lastAssistantReply && input.lastAssistantSourceCount === 0) {
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
