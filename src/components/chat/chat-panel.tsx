"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useChat, type ChatMessage, type ConversationItem } from "@/components/chat/use-chat";
import { RelativeTime } from "@/components/ui/relative-time";
import { widgetAnswerState } from "@/lib/chat/answer-outcome";

type ChatPanelProps = {
  hasDocuments: boolean;
  compact?: boolean;
  initialConversationId?: string | null;
  initialQuestion?: string | null;
  welcomeMessage?: string;
  mode?: "admin" | "widget";
  widgetKey?: string;
  widgetChannel?: "WIDGET" | "HELP_CENTER";
};

const SUGGESTED_PROMPTS = [
  "What is the refund policy?",
  "What are the API rate limits?",
  "How do I reset my password?",
  "What are your support hours?",
];

const RAG_STEPS = [
  "Analyzing question",
  "Searching knowledge base",
  "Ranking relevant chunks",
  "Streaming grounded answer",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2 w-2 rounded-full bg-primary"
          style={{
            animation: "pulse-dot 1.2s infinite",
            animationDelay: `${index * 0.15}s`,
          }}
        />
      ))}
      <span className="text-sm text-slate-500">Streaming response...</span>
    </div>
  );
}

function RagPipeline({ step }: { step: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <Zap className="h-3.5 w-3.5" />
        RAG pipeline
      </div>
      <div className="flex flex-wrap gap-2">
        {RAG_STEPS.map((label, index) => (
          <span
            key={label}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              index <= step
                ? "bg-primary text-white"
                : "bg-white text-slate-400 ring-1 ring-slate-200"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceCitation({
  source,
  index,
}: {
  source: { documentTitle?: string; content: string };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-primary/25"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-slate-800">
            Source {index + 1}: {source.documentTitle ?? "Document"}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {expanded
          ? source.content
          : source.content.length > 320
            ? `${source.content.slice(0, 320)}…`
            : source.content}
      </p>
    </button>
  );
}

function MessageBubble({
  message,
  onFeedback,
  feedbackPendingId,
  compact = false,
}: {
  message: ChatMessage;
  onFeedback?: (messageId: string, helpful: boolean) => void;
  feedbackPendingId?: string | null;
  compact?: boolean;
}) {
  const canRate =
    message.role === "assistant" &&
    message.id !== "welcome" &&
    message.content.trim().length > 0 &&
    message.persisted !== false &&
    onFeedback;
  const answerState =
    message.role === "assistant" && message.id !== "welcome"
      ? widgetAnswerState({
          reply: message.content,
          sourceCount: message.sources?.length ?? 0,
          retrievalMode: message.retrievalMode,
        })
      : null;

  return (
    <div
      className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
    >
      {message.role === "assistant" ? (
        <div className="mt-1 shrink-0 rounded-full bg-primary-soft p-2 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={`rounded-2xl px-4 py-3 leading-7 ${
          message.role === "user"
            ? "max-w-[min(100%,28rem)] bg-primary text-white shadow-sm"
            : compact
              ? "max-w-full flex-1 text-sm"
              : "w-full max-w-4xl text-[15px]"
        } ${
          message.role === "user"
            ? ""
            : "bg-white text-slate-800 ring-1 ring-slate-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {answerState ? (
          <p
            className={`mt-3 text-xs font-medium ${
              answerState === "from_docs" ? "text-accent" : "text-amber-800"
            }`}
          >
            {answerState === "from_docs"
              ? "Answered from your docs"
              : "Not in your docs. A person can take this."}
          </p>
        ) : null}

        {answerState === "from_docs" && message.sources && message.sources.length > 0 ? (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              From your docs
            </p>
            {message.sources.map((source, index) => (
              <SourceCitation
                key={`${message.id}-source-${index}`}
                source={source}
                index={index}
              />
            ))}
          </div>
        ) : null}

        {canRate ? (
          <div className="relative z-10 mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">Was this helpful?</span>
            <button
              type="button"
              aria-label="Mark answer as helpful"
              aria-pressed={message.helpful === true}
              disabled={feedbackPendingId === message.id}
              onClick={() => onFeedback?.(message.id, true)}
              className={`rounded-lg p-1.5 transition ${
                message.helpful === true
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Mark answer as not helpful"
              aria-pressed={message.helpful === false}
              disabled={feedbackPendingId === message.id}
              onClick={() => onFeedback?.(message.id, false)}
              className={`rounded-lg p-1.5 transition ${
                message.helpful === false
                  ? "bg-rose-100 text-rose-700"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {message.role === "user" ? (
        <div className="mt-1 rounded-full bg-slate-200 p-2 text-slate-600">
          <UserRound className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}

function ChatHistoryPanel({
  conversations,
  conversationId,
  onSelect,
  onNewChat,
  onClose,
  className,
}: {
  conversations: ConversationItem[];
  conversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">History</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewChat}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-xs text-slate-400">No conversations yet</p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition ${
                conversationId === conversation.id
                  ? "bg-primary-soft text-primary"
                  : "hover:bg-foreground/[0.05]"
              }`}
            >
              <p className="truncate text-sm font-medium">
                {conversation.title ?? "Support chat"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {conversation._count.messages} messages ·{" "}
                <RelativeTime date={conversation.updatedAt} />
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  hasDocuments,
  compact = false,
  initialConversationId = null,
  initialQuestion = null,
  welcomeMessage,
  mode = "admin",
  widgetKey,
  widgetChannel,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const {
    messages,
    conversations,
    conversationId,
    isSending,
    isEscalating,
    ragStep,
    error,
    sessionReady,
    sendMessage,
    startNewChat,
    loadConversation,
    escalateToTicket,
    submitFeedback,
    canEscalate,
    escalatedTicketId,
    getStoredVisitorEmail,
    saveVisitorEmail,
    feedbackPendingId,
  } = useChat(hasDocuments, welcomeMessage, { mode, widgetKey, widgetChannel });
  const [visitorEmail, setVisitorEmail] = useState(() =>
    mode === "widget" ? getStoredVisitorEmail() : "",
  );
  const canSend =
    hasDocuments &&
    !isSending &&
    input.trim().length > 0 &&
    (mode !== "widget" || sessionReady);

  useEffect(() => {
    if (initializedRef.current) return;

    if (initialConversationId) {
      initializedRef.current = true;
      void loadConversation(initialConversationId);
      return;
    }

    if (initialQuestion?.trim()) {
      if (mode === "widget" && !sessionReady) return;

      initializedRef.current = true;
      if (hasDocuments) {
        void sendMessage(initialQuestion.trim());
      } else {
        queueMicrotask(() =>
          setHandoffNotice(
            mode === "widget"
              ? "Our AI assistant is still being set up. Please check back soon or contact support."
              : "Upload knowledge base documents before asking the AI assistant.",
          ),
        );
      }
      return;
    }
  }, [
    hasDocuments,
    initialConversationId,
    initialQuestion,
    loadConversation,
    mode,
    sendMessage,
    sessionReady,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending, ragStep]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    await sendMessage(question);
  }

  return (
    <div
      className={
        compact
          ? "flex h-[min(70dvh,680px)] max-h-[calc(100dvh-6.5rem)] min-h-[320px] gap-0"
          : "flex h-full min-h-0 gap-4"
      }
    >
      {!compact ? (
        <Card className="hidden w-72 shrink-0 flex-col overflow-hidden p-0 lg:flex">
          <ChatHistoryPanel
            className="flex h-full flex-col"
            conversations={conversations}
            conversationId={conversationId}
            onSelect={loadConversation}
            onNewChat={startNewChat}
          />
        </Card>
      ) : null}

      {!compact && historyOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            aria-label="Close history overlay"
            onClick={() => setHistoryOpen(false)}
          />
          <Card className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden p-0 shadow-xl lg:hidden">
            <ChatHistoryPanel
              className="flex h-full flex-col"
              conversations={conversations}
              conversationId={conversationId}
              onSelect={(id) => {
                loadConversation(id);
                setHistoryOpen(false);
              }}
              onNewChat={() => {
                startNewChat();
                setHistoryOpen(false);
              }}
              onClose={() => setHistoryOpen(false)}
            />
          </Card>
        </>
      ) : null}

      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className={`border-b border-slate-100 bg-slate-50/80 ${compact ? "px-4 py-3" : "px-6 py-4"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {!compact ? (
                <button
                  type="button"
                  className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white lg:hidden"
                  aria-label="Open chat history"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="h-4 w-4" />
                </button>
              ) : null}
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-slate-900">
                    {compact ? "Support widget" : "AI Support Chat"}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {compact
                    ? "Answers from your docs. If it cannot, ask for a person."
                    : "Test answers from your docs. A weak answer can be marked wrong."}
                </p>
              </div>
            </div>
            <Badge tone={hasDocuments ? "success" : "warning"}>
              {hasDocuments ? "Knowledge ready" : "Needs docs"}
            </Badge>
          </div>
        </div>

        <div
          ref={scrollRef}
          className={`flex-1 space-y-5 overflow-y-auto ${
            compact ? "px-4 py-4" : "px-5 py-5 sm:px-8 sm:py-6"
          }`}
        >
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-up">
              <MessageBubble
                message={message}
                onFeedback={submitFeedback}
                feedbackPendingId={feedbackPendingId}
                compact={compact}
              />
            </div>
          ))}

          {isSending && ragStep >= 0 ? <RagPipeline step={ragStep} /> : null}
          {isSending ? <TypingIndicator /> : null}

          {!isSending && hasDocuments && !compact ? (
            <div className="relative z-10 flex flex-wrap gap-2 pt-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/25 hover:bg-primary-soft hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={`border-t border-slate-100 bg-white ${compact ? "px-4 py-3" : "px-6 py-4"}`}>
          {handoffNotice ? (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {handoffNotice}
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {compact ? (
            <div className="mb-3 space-y-2">
              {escalatedTicketId ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-accent">
                    A person has this conversation.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/tickets/${escalatedTicketId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open the case
                    </Link>
                    <Link
                      href="/widget/intake"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open the run log
                    </Link>
                  </div>
                </div>
              ) : canEscalate ? (
                <div>
                  <label htmlFor="visitor-email" className="mb-1 block text-xs font-medium text-slate-600">
                    Email for follow-up
                  </label>
                  <Input
                    id="visitor-email"
                    type="email"
                    value={visitorEmail}
                    onChange={(event) => setVisitorEmail(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        saveVisitorEmail(visitorEmail);
                        void escalateToTicket({ requesterEmail: visitorEmail.trim() });
                      }}
                      disabled={!visitorEmail.trim() || isEscalating}
                    >
                      {isEscalating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Ask a person to take this"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Send a message first to contact support with the full transcript.
                </p>
              )}
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                {escalatedTicketId
                  ? `Ticket #${escalatedTicketId.slice(-6)} — transcript attached`
                  : "When the docs do not cover it, a person gets this conversation."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {escalatedTicketId ? (
                  <>
                    <Link
                      href={`/tickets/${escalatedTicketId}`}
                      className="text-sm font-medium text-primary hover:text-primary"
                    >
                      View ticket
                    </Link>
                    <Link
                      href="/widget/intake"
                      className="text-sm font-medium text-primary hover:text-primary"
                    >
                      Open the run log
                    </Link>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void escalateToTicket()}
                  disabled={!canEscalate}
                >
                  {isEscalating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : escalatedTicketId ? (
                    "With a person"
                  ) : (
                    "Hand this to a person"
                  )}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3">
            <label htmlFor="chat-input" className="sr-only">
              Chat message
            </label>
            <Input
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={compact ? "Ask a question..." : "Ask a support question..."}
            />
            <Button type="submit" disabled={!canSend}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
