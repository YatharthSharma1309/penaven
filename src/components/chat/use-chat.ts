"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatAudience } from "@/lib/chat/answer-outcome";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { buildEscalationTranscript } from "@/lib/tickets/transcript";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ documentTitle?: string; content: string }>;
  retrievalMode?: string;
  chunksMatched?: number;
  helpful?: boolean | null;
  persisted?: boolean;
  confidence?: "high" | "medium" | "low";
  /** A local status line (e.g. the hand-off confirmation), not an answer to label. */
  notice?: boolean;
};

export type ConversationItem = {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
};

export type UseChatOptions = {
  mode?: "admin" | "widget";
  widgetKey?: string;
  widgetChannel?: "WIDGET" | "HELP_CENTER";
};

/** A rate limit reads as a plain sentence here, for a visitor who may not know the term. */
export function chatFailureMessage(status: number, error?: string) {
  if (status === 429) return "Too many questions for now. Please try again later.";
  return error ?? "Chat request failed";
}

/**
 * Messages the chat shows around a hand-off. Staff copy is for the owner's
 * admin chat. Visitor copy is for the business's customers on the widget and
 * help center, so it never mentions tickets, docs, or escalating.
 */
export const CHAT_COPY: Record<
  ChatAudience,
  {
    needsConversation: string;
    needsMessage: string;
    needsEmail: string;
    handoffFailed: string;
    handoffRateLimited: string;
    feedbackFailed: string;
  }
> = {
  staff: {
    needsConversation: "Wait for the chat to connect before escalating to a ticket.",
    needsMessage: "Send a message in chat before escalating to a ticket.",
    needsEmail: "Add your email so support can follow up on this ticket.",
    handoffFailed: "Failed to create ticket",
    handoffRateLimited: "Rate limit exceeded",
    feedbackFailed: "Failed to save feedback",
  },
  visitor: {
    needsConversation: "Ask your question first. Then a person can pick it up.",
    needsMessage: "Ask your question first. Then a person can pick it up.",
    needsEmail: "Add your email so we can reply to you.",
    handoffFailed: "We could not pass this to a person just now. Please try again.",
    handoffRateLimited: "Too many requests for now. Please try again later.",
    feedbackFailed: "Your rating could not be saved. Please try again.",
  },
};

/** Visitors get a plain reason they can act on, never the raw validation text. */
export function handoffFailureMessage(
  audience: ChatAudience,
  status: number,
  error?: string,
) {
  const copy = CHAT_COPY[audience];
  if (audience === "staff") return error ?? copy.handoffFailed;
  if (status === 429) return copy.handoffRateLimited;
  if (status === 400 && error && /email/i.test(error)) {
    return "Enter a valid email address.";
  }
  if (status === 400 && error && /conversation could not be found/i.test(error)) {
    return error;
  }
  return copy.handoffFailed;
}

/** The chat line after a hand-off. Visitors get no ticket number; they get who replies and where. */
export function handoffConfirmation(
  audience: ChatAudience,
  input: {
    ticketId: string;
    duplicate: boolean;
    followsUp: boolean;
    email?: string;
  },
) {
  if (audience === "visitor") {
    const lead = input.duplicate
      ? "A person already has this conversation."
      : "Thanks. A person has this conversation.";
    return input.email ? `${lead} We'll reply to ${input.email}.` : lead;
  }

  const shortId = input.ticketId.slice(-6);
  if (input.followsUp) {
    return input.duplicate
      ? `You already have open ticket #${shortId}. A teammate will follow up with this chat transcript.`
      : `Ticket #${shortId} created. Full transcript attached — a teammate will follow up.`;
  }
  return input.duplicate
    ? `Open ticket #${shortId} already exists for this chat.`
    : `Ticket #${shortId} created with the full transcript.`;
}

function getVisitorStorageKey(widgetKey?: string) {
  return widgetKey
    ? `relayai_visitor_${widgetKey}`
    : "relayai_visitor_admin";
}

function getVisitorTokenStorageKey(widgetKey?: string) {
  return widgetKey
    ? `relayai_visitor_token_${widgetKey}`
    : "relayai_visitor_token_admin";
}

function getVisitorEmailStorageKey(widgetKey?: string) {
  return widgetKey
    ? `relayai_visitor_email_${widgetKey}`
    : "relayai_visitor_email_admin";
}

function readStoredValue(primaryKey: string, legacyKey: string) {
  const value = localStorage.getItem(primaryKey);
  if (value) return value;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy) {
    localStorage.setItem(primaryKey, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  }
  return null;
}

function getVisitorId(widgetKey?: string) {
  const storageKey = getVisitorStorageKey(widgetKey);
  const legacyKey = widgetKey
    ? `supportai_visitor_${widgetKey}`
    : "supportai_visitor_admin";
  const existing = readStoredValue(storageKey, legacyKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(storageKey, id);
  return id;
}

async function ensureVisitorSession(widgetKey: string, visitorId: string) {
  const tokenKey = getVisitorTokenStorageKey(widgetKey);
  const cachedToken = sessionStorage.getItem(tokenKey);
  if (cachedToken) {
    return { visitorId, visitorToken: cachedToken };
  }

  const response = await fetch("/api/widget/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": widgetKey,
    },
    body: JSON.stringify({ visitorId }),
  });

  if (!response.ok) {
    throw new Error("Chat could not connect. Refresh the page and try again.");
  }

  const data = (await response.json()) as {
    visitorId: string;
    visitorToken: string;
  };

  localStorage.setItem(getVisitorStorageKey(widgetKey), data.visitorId);
  sessionStorage.setItem(tokenKey, data.visitorToken);

  return data;
}

export function useChat(
  hasDocuments: boolean,
  welcomeMessage?: string,
  options: UseChatOptions = {},
) {
  const mode = options.mode ?? "admin";
  const widgetKey = options.widgetKey;
  const widgetChannel = options.widgetChannel ?? "WIDGET";
  const isWidget = mode === "widget";
  const audience: ChatAudience = isWidget ? "visitor" : "staff";
  const copy = CHAT_COPY[audience];

  const defaultWelcome =
    welcomeMessage ??
    (isWidget
      ? "Hi! Ask a question and I'll answer from our help pages."
      : "Hi! I'm grounded in your knowledge base. Ask about refunds, billing, API limits, or support hours — I'll cite my sources.");

  const visitorId = useMemo(() => {
    if (!isWidget || typeof window === "undefined") return null;
    return getVisitorId(widgetKey);
  }, [isWidget, widgetKey]);

  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(!isWidget);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: hasDocuments
        ? defaultWelcome
        : isWidget
          ? "Support is not available yet. Please try again later."
          : "Upload documents from the knowledge base, then ask me anything.",
      persisted: false,
    },
  ]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [escalatedTicketId, setEscalatedTicketId] = useState<string | null>(
    null,
  );
  const [escalatedEmail, setEscalatedEmail] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [ragStep, setRagStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [feedbackPendingId, setFeedbackPendingId] = useState<string | null>(null);
  const escalateLockRef = useRef(false);

  useEffect(() => {
    if (!isWidget || !widgetKey || !visitorId) return;

    let cancelled = false;

    queueMicrotask(() => {
      void ensureVisitorSession(widgetKey, visitorId)
        .then((session) => {
          if (!cancelled) {
            setVisitorToken(session.visitorToken);
            setSessionReady(true);
          }
        })
        .catch((sessionError) => {
          if (!cancelled) {
            setError(
              sessionError instanceof Error
                ? sessionError.message
                : "Chat could not connect. Refresh the page and try again.",
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isWidget, visitorId, widgetKey]);

  const streamUrl = isWidget ? "/api/widget/chat/stream" : "/api/chat/stream";
  const ticketsUrl = isWidget ? "/api/widget/tickets" : "/api/tickets";

  const loadConversations = useCallback(async () => {
    if (isWidget) return;
    const response = await fetch("/api/conversations");
    const data = await response.json();
    if (response.ok) setConversations(data.conversations);
  }, [isWidget]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (isWidget) return;

      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to load conversation");
        return;
      }

      setConversationId(id);
      setEscalatedTicketId(
        typeof data.openTicketId === "string" ? data.openTicketId : null,
      );
      setMessages(
        data.conversation.messages
          .filter(
            (message: { role: string }) =>
              message.role === "USER" || message.role === "ASSISTANT",
          )
          .map(
            (message: {
              id: string;
              role: string;
              content: string;
              sources?: ChatMessage["sources"];
              helpful?: boolean | null;
            }) => ({
              id: message.id,
              role: message.role === "USER" ? "user" : "assistant",
              content: message.content,
              sources: message.sources as ChatMessage["sources"],
              helpful: message.helpful ?? null,
              persisted: true,
            }),
          ),
      );
      setError(null);
    },
    [isWidget],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadConversations();
    });
  }, [loadConversations]);

  useEffect(() => {
    if (!isSending) return;

    const steps = 4;
    const timers = Array.from({ length: steps }, (_, index) =>
      window.setTimeout(() => setRagStep(index), index * 450),
    );
    return () => timers.forEach(clearTimeout);
  }, [isSending]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isSending) return;
      if (isWidget && (!sessionReady || !visitorId || !visitorToken)) {
        setError("Connecting chat session. Please try again in a moment.");
        return;
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question.trim(),
        persisted: true,
      };

      setMessages((current) => [...current, userMessage]);
      setIsSending(true);
      setRagStep(0);
      setError(null);

      const assistantId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          persisted: false,
        },
      ]);

      try {
        const priorConversationId = conversationId;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (isWidget && widgetKey) {
          headers["X-Widget-Key"] = widgetKey;
        }

        const response = await fetch(streamUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: question.trim(),
            conversationId,
            ...(isWidget
              ? { visitorId, visitorToken, channel: widgetChannel }
              : {}),
          }),
        });

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 404 || !priorConversationId) {
            setConversationId(null);
          }
          setMessages((current) =>
            current.filter(
              (message) =>
                message.id !== assistantId && message.id !== userMessage.id,
            ),
          );
          throw new Error(chatFailureMessage(response.status, data.error));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            const eventLine = lines.find((line) => line.startsWith("event: "));
            const dataLine = lines.find((line) => line.startsWith("data: "));
            if (!eventLine || !dataLine) continue;

            const event = eventLine.replace("event: ", "");
            let data: Record<string, unknown>;

            try {
              data = JSON.parse(dataLine.replace("data: ", ""));
            } catch {
              continue;
            }

            if (event === "meta") {
              if (data.conversationId) {
                setConversationId(String(data.conversationId));
              }
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        sources: data.sources as ChatMessage["sources"],
                        retrievalMode: data.retrievalMode as string,
                        chunksMatched: data.chunksMatched as number,
                        confidence: data.confidence as ChatMessage["confidence"],
                      }
                    : message,
                ),
              );
            }

            if (event === "token") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content: message.content + String(data.text ?? ""),
                      }
                    : message,
                ),
              );
            }

            if (event === "done") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        id: data.messageId ? String(data.messageId) : assistantId,
                        content: String(data.reply ?? message.content),
                        persisted: true,
                      }
                    : message,
                ),
              );
            }

            if (event === "error") {
              throw new Error(String(data.error ?? "Stream failed"));
            }
          }
        }

        await loadConversations();
      } catch (chatError) {
        // Only drop conversationId when the turn had no prior conversation
        // (first-message rollback) or the server already 404'd it above.
        // Multi-turn failures must keep the id so escalate still works.
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !== assistantId && message.id !== userMessage.id,
          ),
        );
        await loadConversations();
        setError(
          chatError instanceof Error
            ? chatError.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        setIsSending(false);
        setRagStep(-1);
      }
    },
    [
      conversationId,
      isSending,
      isWidget,
      loadConversations,
      streamUrl,
      visitorId,
      visitorToken,
      sessionReady,
      widgetChannel,
      widgetKey,
    ],
  );

  const startNewChat = useCallback(() => {
    setConversationId(null);
    setEscalatedTicketId(null);
    setEscalatedEmail(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: hasDocuments
          ? defaultWelcome
          : isWidget
            ? "Support is not available yet. Please try again later."
            : "Upload documents from the knowledge base.",
        persisted: false,
      },
    ]);
    setError(null);
  }, [defaultWelcome, hasDocuments, isWidget]);

  const escalateToTicket = useCallback(async (options?: {
    requesterEmail?: string;
    requesterName?: string;
  }) => {
    if (isEscalating || isSending || escalatedTicketId || escalateLockRef.current) {
      return;
    }

    if (!conversationId) {
      setError(copy.needsConversation);
      return;
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      setError(copy.needsMessage);
      return;
    }

    let requesterEmail = options?.requesterEmail?.trim() || undefined;
    const requesterName = options?.requesterName?.trim() || undefined;
    // The demo keeps no contact details and nobody follows up.
    const followsUp = isWidget && !isPublicDemoMode();

    if (followsUp && widgetKey && !requesterEmail) {
      requesterEmail =
        readStoredValue(
          getVisitorEmailStorageKey(widgetKey),
          `supportai_visitor_email_${widgetKey}`,
        )?.trim() || undefined;
    }

    if (followsUp && !requesterEmail) {
      setError(copy.needsEmail);
      return;
    }

    escalateLockRef.current = true;
    setIsEscalating(true);
    setError(null);

    try {
      const transcript =
        buildEscalationTranscript(
          messages.filter(
            (message) =>
              message.id !== "welcome" && message.content.trim().length > 0,
          ),
        ) || `user: ${lastUserMessage.content}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (isWidget && widgetKey) {
        headers["X-Widget-Key"] = widgetKey;
      }

      const response = await fetch(ticketsUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Escalation: ${lastUserMessage.content.slice(0, 80)}`,
          description: transcript,
          conversationId,
          priority: "HIGH",
          ...(isWidget
            ? { visitorId, visitorToken, requesterEmail, requesterName }
            : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(handoffFailureMessage(audience, response.status, data.error));
      }

      const ticket = data.ticket as { id: string };
      const duplicate = Boolean(data.duplicate);
      const replyTo = followsUp ? requesterEmail : undefined;
      setEscalatedTicketId(ticket.id);
      setEscalatedEmail(replyTo ?? null);

      if (isWidget && widgetKey && requesterEmail) {
        localStorage.setItem(getVisitorEmailStorageKey(widgetKey), requesterEmail);
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: handoffConfirmation(audience, {
            ticketId: ticket.id,
            duplicate,
            followsUp,
            email: replyTo,
          }),
          persisted: false,
          notice: true,
        },
      ]);
    } catch (escalationError) {
      // A network failure surfaces as a TypeError with browser wording.
      setError(
        escalationError instanceof Error && !(escalationError instanceof TypeError)
          ? escalationError.message
          : copy.handoffFailed,
      );
    } finally {
      escalateLockRef.current = false;
      setIsEscalating(false);
    }
  }, [
    audience,
    conversationId,
    copy,
    escalatedTicketId,
    isEscalating,
    isSending,
    isWidget,
    messages,
    ticketsUrl,
    visitorId,
    visitorToken,
    widgetKey,
  ]);

  const submitFeedback = useCallback(
    async (messageId: string, helpful: boolean) => {
      if (messageId === "welcome" || feedbackPendingId) return;
      if (isWidget && (!sessionReady || !visitorToken)) return;

      setFeedbackPendingId(messageId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (isWidget && widgetKey) {
        headers["X-Widget-Key"] = widgetKey;
      }

      const feedbackUrl = isWidget
        ? `/api/widget/messages/${messageId}/feedback`
        : `/api/messages/${messageId}/feedback`;

      const response = await fetch(feedbackUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          helpful,
          ...(isWidget ? { visitorId, visitorToken } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(
          isWidget ? copy.feedbackFailed : (data.error ?? copy.feedbackFailed),
        );
        setFeedbackPendingId(null);
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, helpful } : message,
        ),
      );
      setFeedbackPendingId(null);
    },
    [copy, feedbackPendingId, isWidget, sessionReady, visitorId, visitorToken, widgetKey],
  );

  const canEscalate =
    Boolean(conversationId) &&
    !isSending &&
    !isEscalating &&
    !escalatedTicketId;

  const getStoredVisitorEmail = useCallback(() => {
    if (!isWidget || !widgetKey || typeof window === "undefined") return "";
    return (
      readStoredValue(
        getVisitorEmailStorageKey(widgetKey),
        `supportai_visitor_email_${widgetKey}`,
      ) ?? ""
    );
  }, [isWidget, widgetKey]);

  const saveVisitorEmail = useCallback(
    (email: string) => {
      if (!isWidget || !widgetKey || typeof window === "undefined") return;
      localStorage.setItem(getVisitorEmailStorageKey(widgetKey), email.trim());
    },
    [isWidget, widgetKey],
  );

  return {
    messages,
    conversations,
    conversationId,
    escalatedTicketId,
    escalatedEmail,
    isSending,
    isEscalating,
    canEscalate,
    ragStep,
    error,
    sessionReady,
    sendMessage,
    startNewChat,
    loadConversation,
    escalateToTicket,
    submitFeedback,
    feedbackPendingId,
    getStoredVisitorEmail,
    saveVisitorEmail,
  };
}
