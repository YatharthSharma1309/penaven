import { db } from "@/lib/db";
import {
  getAiClient,
  getChatModel,
  isAiConfigured,
  isEmbeddingEnabled,
  shouldAttemptGemini,
} from "@/lib/ai";
import type { ModelUsage } from "@/lib/billing/cost";
import { aiUnavailableReply, type ChatChannel } from "@/lib/chat/answer-outcome";
import { geminiChatCompletion } from "@/lib/gemini";
import { notifyOpsWorker } from "@/lib/ops-worker";
import { computeGroundingConfidence, type GroundingConfidence } from "@/lib/rag/confidence";
import { MAX_RAG_CHUNKS_FETCH } from "@/lib/rag/constants";
import { createEmbedding } from "@/lib/rag/embed";
import {
  buildRagPrompt,
  retrieveRelevantChunksWithMode,
  type ChunkWithScore,
} from "@/lib/rag/retrieve";
import {
  buildAgentSystemPrompt,
  getAgentSettings,
  type AgentSettings,
} from "@/lib/settings";

export type ChatSource = {
  documentTitle?: string;
  content: string;
};

export type PreparedChat = {
  conversationId: string;
  userMessageId: string;
  rankedChunks: ChunkWithScore[];
  sources: ChatSource[];
  retrievalMode: "vector" | "keyword";
  chunksMatched: number;
  confidence: GroundingConfidence;
  fallbackReply: string;
};

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public code:
      | "CONVERSATION_NOT_FOUND"
      | "INVALID_MESSAGE"
      | "AI_UNAVAILABLE"
      | "AI_FAILED",
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

const DEFAULT_AGENT = "support-concierge";

const NEUTRAL_REPLY_DRAFT =
  "Thanks for reaching out. I'm reviewing your request and will follow up shortly with next steps.";

function redactPII(value: string) {
  // Keep this intentionally lightweight: remove common email/phone patterns.
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(\+?\d[\d\s().-]{8,}\d)/g, "[REDACTED_PHONE]")
    .replace(/\b\d{8,}\b/g, "[REDACTED_NUMBER]");
}

function summarizeForLog(value: string, maxChars: number) {
  return redactPII(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

function logLlmCall({
  model,
  latencyMs,
  workspaceId,
  agent,
  trigger,
  decision,
  requestSummary,
  responseSummary,
}: {
  model: string;
  latencyMs: number;
  workspaceId: string;
  agent: string;
  trigger: string;
  decision: string;
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
}) {
  console.info("llm_call", {
    model,
    latency_ms: latencyMs,
    workspace_id: workspaceId,
    agent,
    trigger,
    decision,
    request_summary: requestSummary,
    response_summary: responseSummary,
  });

  // Fire-and-forget Cloud Run evidence when Gemini succeeds in production.
  if (decision === "gemini_success") {
    void notifyOpsWorker({
      workspace_id: workspaceId,
      agent,
      trigger,
      model,
      decision,
      latency_ms: latencyMs,
      summary:
        typeof responseSummary.reply_snippet === "string"
          ? responseSummary.reply_snippet
          : null,
    });
  }
}

async function touchConversation(conversationId: string) {
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function rollbackFailedTurn(
  conversationId: string,
  userMessageId: string,
) {
  await db.message.delete({ where: { id: userMessageId } }).catch(() => null);

  const remaining = await db.message.count({
    where: { conversationId },
  });

  if (remaining === 0) {
    await db.conversation.delete({ where: { id: conversationId } }).catch(() => null);
  }
}

async function retrieveChatContext(
  organizationId: string,
  message: string,
  channel: ChatChannel,
) {
  const chunks = await db.documentChunk.findMany({
    where: {
      document: {
        organizationId,
        status: "READY",
      },
    },
    take: MAX_RAG_CHUNKS_FETCH,
    orderBy: { chunkIndex: "asc" },
    include: {
      document: {
        select: { title: true },
      },
    },
  });

  let queryEmbedding: number[] | null = null;

  if (isEmbeddingEnabled()) {
    try {
      queryEmbedding = await createEmbedding(message);
    } catch (error) {
      console.error("Embedding failed, falling back to keyword retrieval:", error);
      queryEmbedding = null;
    }
  }

  const mappedChunks = chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    content: chunk.content,
    embedding: chunk.embedding,
    documentTitle: chunk.document.title,
  }));

  const { chunks: rankedChunks, mode: retrievalMode } =
    retrieveRelevantChunksWithMode(message, mappedChunks, queryEmbedding);

  const confidence = computeGroundingConfidence(rankedChunks, retrievalMode);

  const sources = rankedChunks.map((chunk) => ({
    documentTitle: chunk.documentTitle,
    content: chunk.content,
  }));

  // With no matching chunk nothing is known. With one, only the model is missing,
  // and raw document text must never stand in for its answer.
  const fallbackReply =
    rankedChunks.length === 0
      ? "I could not find relevant information in your knowledge base. Try uploading FAQs or escalate to a support ticket."
      : aiUnavailableReply(channel);

  return {
    rankedChunks,
    sources,
    retrievalMode,
    chunksMatched: rankedChunks.length,
    confidence,
    fallbackReply,
  };
}

export async function prepareSandboxChatTurn(
  organizationId: string,
  message: string,
) {
  return retrieveChatContext(organizationId, message, "ADMIN");
}

export async function prepareChatTurn(
  organizationId: string,
  message: string,
  conversationId: string | null,
  options?: {
    visitorId?: string | null;
    channel?: ChatChannel;
  },
) {
  const visitorId = options?.visitorId ?? null;
  const channel = options?.channel ?? "ADMIN";

  let conversation = null;

  if (conversationId) {
    conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        ...(visitorId ? { visitorId } : {}),
      },
    });

    if (!conversation) {
      throw new ChatServiceError(
        "Conversation not found",
        "CONVERSATION_NOT_FOUND",
      );
    }
  } else {
    conversation = await db.conversation.create({
      data: {
        organizationId,
        title: message.slice(0, 80),
        visitorId,
        channel,
      },
    });
  }

  const userMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
    },
  });

  await touchConversation(conversation.id);

  try {
    const context = await retrieveChatContext(organizationId, message, channel);

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      ...context,
    } satisfies PreparedChat;
  } catch (error) {
    await rollbackFailedTurn(conversation.id, userMessage.id);
    throw error;
  }
}

async function resolveSystemPrompt(organizationId: string) {
  const settings = await getAgentSettings(organizationId);
  return buildAgentSystemPrompt(settings);
}

export async function generateChatReply(
  organizationId: string,
  message: string,
  rankedChunks: ChunkWithScore[],
  fallbackReply: string,
  options?: {
    trigger?: string;
    agent?: string;
  },
) {
  const trigger = options?.trigger ?? "admin.chat.reply";
  const agent = options?.agent ?? DEFAULT_AGENT;

  if (rankedChunks.length === 0) {
    return fallbackReply;
  }

  if (!isAiConfigured()) {
    return fallbackReply;
  }

  const prompt = buildRagPrompt(message, rankedChunks);
  const systemPrompt = await resolveSystemPrompt(organizationId);

  const requestSummary = {
    user_message_len: message.length,
    user_message_snippet: summarizeForLog(message, 120),
    ranked_chunks: rankedChunks.length,
  };

  if (shouldAttemptGemini()) {
    try {
      const { text, model, latencyMs } = await geminiChatCompletion({
        systemPrompt,
        userPrompt: prompt,
        temperature: 0.2,
      });

      const reply = text.trim();
      if (!reply) throw new Error("empty_reply");

      logLlmCall({
        model,
        latencyMs,
        workspaceId: organizationId,
        agent,
        trigger,
        decision: "gemini_success",
        requestSummary,
        responseSummary: {
          reply_len: reply.length,
          reply_snippet: summarizeForLog(reply, 120),
        },
      });

      return reply;
    } catch (error) {
      logLlmCall({
        model: "gemini",
        latencyMs: 0,
        workspaceId: organizationId,
        agent,
        trigger,
        decision: "gemini_failed",
        requestSummary,
        responseSummary: {
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });

      // Fall through to OpenRouter when Gemini fails (quota, network, etc.).
    }
  }

  const client = getAiClient();
  if (!client) {
    return fallbackReply;
  }

  const start = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const latencyMs = Date.now() - start;
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error("empty_reply");

    logLlmCall({
      model: getChatModel(),
      latencyMs,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "openrouter_success",
      requestSummary,
      responseSummary: {
        reply_len: reply.length,
        reply_snippet: summarizeForLog(reply, 120),
      },
    });

    return reply;
  } catch {
    const latencyMs = Date.now() - start;

    logLlmCall({
      model: getChatModel(),
      latencyMs,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "openrouter_failed",
      requestSummary,
      responseSummary: {
        error: "completion_failed",
      },
    });

    return fallbackReply;
  }
}

export async function streamChatReply(
  organizationId: string,
  message: string,
  rankedChunks: ChunkWithScore[],
  fallbackReply: string,
  options?: {
    trigger?: string;
    agent?: string;
  },
) {
  const trigger = options?.trigger ?? "chat.stream";
  const agent = options?.agent ?? DEFAULT_AGENT;

  if (rankedChunks.length === 0 || !isAiConfigured()) {
    return {
      stream: null,
      reply: fallbackReply,
      provider: "none",
      model: "N/A",
      latencyMs: 0,
      usage: null,
    };
  }

  const prompt = buildRagPrompt(message, rankedChunks);
  const systemPrompt = await resolveSystemPrompt(organizationId);

  const requestSummary = {
    user_message_len: message.length,
    user_message_snippet: summarizeForLog(message, 120),
    ranked_chunks: rankedChunks.length,
  };

  if (shouldAttemptGemini()) {
    try {
      const { text, model, latencyMs, usage } = await geminiChatCompletion({
        systemPrompt,
        userPrompt: prompt,
        temperature: 0.2,
      });

      const reply = text.trim();
      if (!reply) throw new Error("empty_reply");

      logLlmCall({
        model,
        latencyMs,
        workspaceId: organizationId,
        agent,
        trigger,
        decision: "gemini_success",
        requestSummary,
        responseSummary: {
          reply_len: reply.length,
          reply_snippet: summarizeForLog(reply, 120),
          input_tokens: usage?.inputTokens ?? null,
          output_tokens: usage?.outputTokens ?? null,
        },
      });

      // We don't stream Gemini tokens yet; stream-handler will stream words.
      return { stream: null, reply, provider: "gemini", model, latencyMs, usage };
    } catch (error) {
      logLlmCall({
        model: "gemini",
        latencyMs: 0,
        workspaceId: organizationId,
        agent,
        trigger,
        decision: "gemini_failed",
        requestSummary,
        responseSummary: {
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
    }
  }

  const client = getAiClient();
  if (!client) {
    return {
      stream: null,
      reply: fallbackReply,
      provider: "none",
      model: "N/A",
      latencyMs: 0,
      usage: null,
    };
  }

  const start = Date.now();

  try {
    const stream = await client.chat.completions.create({
      model: getChatModel(),
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    logLlmCall({
      model: getChatModel(),
      latencyMs: Date.now() - start,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "openrouter_stream_requested",
      requestSummary,
      responseSummary: {
        stream: true,
      },
    });

    return {
      stream,
      reply: null,
      provider: "openrouter",
      model: getChatModel(),
      latencyMs: Date.now() - start,
      usage: null,
    };
  } catch {
    logLlmCall({
      model: getChatModel(),
      latencyMs: Date.now() - start,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "openrouter_failed",
      requestSummary,
      responseSummary: {
        error: "completion_failed",
      },
    });

    return {
      stream: null,
      reply: fallbackReply,
      provider: "openrouter",
      model: getChatModel(),
      latencyMs: Date.now() - start,
      usage: null satisfies ModelUsage | null,
    };
  }
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  sources: ChatSource[],
) {
  const message = await db.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content,
      sources,
    },
  });

  await touchConversation(conversationId);

  return message;
}

export async function suggestTicketReply(
  organizationId: string,
  ticket: {
    title: string;
    description: string;
    conversation: {
      messages: Array<{ role: string; content: string }>;
    } | null;
  },
  options?: {
    trigger?: string;
    agent?: string;
  },
) {
  const trigger = options?.trigger ?? "ticket.suggest-reply";
  const agent = options?.agent ?? DEFAULT_AGENT;

  if (!isAiConfigured()) {
    return NEUTRAL_REPLY_DRAFT;
  }

  const transcript = ticket.conversation?.messages
    .filter((message) => message.role !== "SYSTEM")
    .map((message) => `${message.role.toLowerCase()}: ${message.content}`)
    .join("\n\n") ?? "";

  const query = transcript
    ? `${ticket.title}\n\nLatest context:\n${transcript.slice(-1200)}`
    : ticket.title;

  let queryEmbedding: number[] | null = null;

  if (isEmbeddingEnabled()) {
    try {
      queryEmbedding = await createEmbedding(query.slice(0, 500));
    } catch (error) {
      console.error("Embedding failed for ticket suggest-reply:", error);
      queryEmbedding = null;
    }
  }

  const chunks = await db.documentChunk.findMany({
    where: {
      document: { organizationId, status: "READY" },
    },
    take: MAX_RAG_CHUNKS_FETCH,
    orderBy: { chunkIndex: "asc" },
    include: { document: { select: { title: true } } },
  });

  const { chunks: rankedChunks } = retrieveRelevantChunksWithMode(
    query,
    chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      documentTitle: chunk.document.title,
    })),
    queryEmbedding,
  );

  const context =
    rankedChunks.length > 0
      ? rankedChunks
          .map(
            (chunk, index) =>
              `[Source ${index + 1}]\n${chunk.content.slice(0, 400)}`,
          )
          .join("\n\n")
      : "No matching documentation found.";

  const requestSummary = {
    ticket_title_snippet: summarizeForLog(ticket.title, 120),
    ticket_description_len: ticket.description.length,
    transcript_present: Boolean(transcript),
    transcript_len: transcript.length,
    ranked_chunks: rankedChunks.length,
  };

  const systemPrompt =
    "You are a support agent drafting a helpful reply to a customer ticket. Be empathetic, concise, and grounded in the provided context and transcript.";

  const userPrompt = `Ticket: ${ticket.title}\n\nDescription:\n${ticket.description}\n\nTranscript:\n${transcript || "None"}\n\nKnowledge context:\n${context}\n\nDraft a reply the agent can send.`;

  try {
    if (shouldAttemptGemini()) {
      try {
        const { text, model, latencyMs } = await geminiChatCompletion({
          systemPrompt,
          userPrompt,
          temperature: 0.3,
        });

        const suggestion = text.trim();

        if (!suggestion) {
          throw new ChatServiceError(
            "AI returned an empty suggestion",
            "AI_FAILED",
          );
        }

        logLlmCall({
          model,
          latencyMs,
          workspaceId: organizationId,
          agent,
          trigger,
          decision: "gemini_success",
          requestSummary,
          responseSummary: {
            reply_len: suggestion.length,
            reply_snippet: summarizeForLog(suggestion, 120),
          },
        });

        return suggestion;
      } catch (error) {
        if (error instanceof ChatServiceError) {
          throw error;
        }
        logLlmCall({
          model: "gemini",
          latencyMs: 0,
          workspaceId: organizationId,
          agent,
          trigger,
          decision: "gemini_failed",
          requestSummary,
          responseSummary: {
            error: error instanceof Error ? error.message : "unknown_error",
          },
        });
        // Fall through to OpenRouter.
      }
    }

    const client = getAiClient();
    if (!client) {
      throw new ChatServiceError("AI client unavailable", "AI_UNAVAILABLE");
    }

    const start = Date.now();

    const completion = await client.chat.completions.create({
      model: getChatModel(),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.3,
    });

    const latencyMs = Date.now() - start;

    const suggestion = completion.choices[0]?.message?.content?.trim();
    if (!suggestion) {
      throw new ChatServiceError(
        "AI returned an empty suggestion",
        "AI_FAILED",
      );
    }

    logLlmCall({
      model: getChatModel(),
      latencyMs,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "openrouter_success",
      requestSummary,
      responseSummary: {
        reply_len: suggestion.length,
        reply_snippet: summarizeForLog(suggestion, 120),
      },
    });

    return suggestion;
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }

    logLlmCall({
      model: shouldAttemptGemini() ? "gemini" : getChatModel(),
      latencyMs: 0,
      workspaceId: organizationId,
      agent,
      trigger,
      decision: "ai_failed",
      requestSummary,
      responseSummary: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    throw new ChatServiceError("AI request failed", "AI_FAILED");
  }
}

export type { AgentSettings };
