import {
  ChatServiceError,
  prepareChatTurn,
  prepareSandboxChatTurn,
  rollbackFailedTurn,
  saveAssistantMessage,
  streamChatReply,
} from "@/lib/chat/service";

import { getChatModel, isAiConfigured, shouldAttemptGemini } from "@/lib/ai";
import { mapPrismaError } from "@/lib/api/prisma-errors";
import { getGeminiChatModel } from "@/lib/gemini";
import { runCostUsd } from "@/lib/billing/cost";
import { isAiUnavailableReply, supportRunOutcome } from "@/lib/chat/answer-outcome";
import { db } from "@/lib/db";

const STREAM_FAILED_MESSAGE = "Chat is unavailable right now. Please try again.";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export type ChatStreamOptions = {
  organizationId: string;
  message: string;
  conversationId: string | null;
  visitorId?: string | null;
  channel?: "ADMIN" | "WIDGET" | "HELP_CENTER";
  sandbox?: boolean;
};

export async function createChatStreamResponse({
  organizationId,
  message,
  conversationId,
  visitorId,
  channel = "ADMIN",
  sandbox = false,
}: ChatStreamOptions) {
  let rollbackTarget: { conversationId: string; userMessageId: string } | null =
    null;

  try {
    const laneRoutingStartAt = Date.now();

    const prepared = sandbox
      ? {
          conversationId: null,
          userMessageId: null,
          ...(await prepareSandboxChatTurn(organizationId, message)),
        }
      : await prepareChatTurn(organizationId, message, conversationId, {
          visitorId,
          channel,
        });

    const shouldLogExecution =
      !sandbox && prepared.conversationId && prepared.userMessageId && channel !== "ADMIN";

    const executionRun = shouldLogExecution
      ? await db.executionRun.create({
          data: {
            workspaceId: organizationId,
            conversationId: prepared.conversationId,
            userMessageId: prepared.userMessageId,
            channel,
            trigger: "widget_intake",
          },
        })
      : null;

    const modelForEvidence = shouldAttemptGemini()
      ? getGeminiChatModel()
      : isAiConfigured()
        ? getChatModel()
        : "N/A";

    const laneDecision =
      prepared.chunksMatched === 0
        ? "route_fallback_no_knowledge"
        : shouldAttemptGemini()
          ? "route_to_gemini"
          : isAiConfigured()
            ? "route_to_openrouter"
            : "route_fallback_ai_unconfigured";

    if (executionRun) {
      await db.executionLogEntry.create({
        data: {
          runId: executionRun.id,
          workspaceId: organizationId,
          conversationId: prepared.conversationId,
          userMessageId: prepared.userMessageId,
          agent: "lane-router",
          trigger: "widget_intake",
          model: modelForEvidence,
          decision: laneDecision,
          latencyMs: Date.now() - laneRoutingStartAt,
          metadata: {
            chunksMatched: prepared.chunksMatched,
            confidence: prepared.confidence,
            retrievalMode: prepared.retrievalMode,
            sourceCount: prepared.sources.length,
          },
        },
      });
    }

    if (!sandbox && prepared.conversationId && prepared.userMessageId) {
      rollbackTarget = {
        conversationId: prepared.conversationId,
        userMessageId: prepared.userMessageId,
      };
    }

    const trigger = sandbox
      ? "chat.stream.sandbox"
      : channel === "HELP_CENTER"
        ? "help_center.chat.stream"
        : channel === "WIDGET"
          ? "widget.chat.stream"
          : "admin.chat.stream";

    const llmRequestStartedAt = Date.now();

    const {
      stream,
      reply: fallback,
      provider: llmProvider,
      model: llmModel,
      latencyMs: llmLatencyMs,
      usage: llmUsage,
    } =
      await streamChatReply(
      organizationId,
      message,
      prepared.rankedChunks,
      prepared.fallbackReply,
      { trigger },
      );

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              encodeSse("meta", {
                conversationId: prepared.conversationId,
                sources: prepared.sources,
                retrievalMode: prepared.retrievalMode,
                chunksMatched: prepared.chunksMatched,
                confidence: prepared.confidence,
              }),
            ),
          );

          let fullReply = fallback ?? "";

          if (stream) {
            fullReply = "";
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content ?? "";
              if (!text) continue;
              fullReply += text;
              controller.enqueue(encoder.encode(encodeSse("token", { text })));
            }
            if (!fullReply.trim()) {
              fullReply = prepared.fallbackReply;
              controller.enqueue(
                encoder.encode(encodeSse("token", { text: fullReply })),
              );
            }
          } else {
            for (const word of fullReply.split(" ")) {
              controller.enqueue(
                encoder.encode(encodeSse("token", { text: `${word} ` })),
              );
            }
          }

          if (!sandbox && prepared.conversationId) {
            const assistantMessage = await saveAssistantMessage(
              prepared.conversationId,
              fullReply,
              prepared.sources,
            );

            if (executionRun && prepared.userMessageId) {
              const latencyMs =
                llmProvider === "gemini"
                  ? llmLatencyMs ?? Date.now() - llmRequestStartedAt
                  : Date.now() - llmRequestStartedAt;

              const agent =
                llmProvider === "gemini"
                  ? "support-concierge"
                  : llmProvider === "openrouter"
                    ? "support-concierge"
                    : "llm";

              const outcome = supportRunOutcome({
                chunksMatched: prepared.chunksMatched,
                confidence: prepared.confidence,
                reply: fullReply,
              });
              const decision = isAiUnavailableReply(fullReply)
                ? "llm_unavailable_fallback"
                : llmProvider === "gemini"
                  ? "gemini_success"
                  : llmProvider === "openrouter" && stream
                    ? "openrouter_stream_completed"
                    : "llm_non_stream_reply";

              await db.executionLogEntry.create({
                data: {
                  runId: executionRun.id,
                  workspaceId: organizationId,
                  conversationId: prepared.conversationId,
                  userMessageId: prepared.userMessageId,
                  agent,
                  trigger: "widget_intake",
                  model: llmModel ?? modelForEvidence,
                  decision,
                  latencyMs,
                  metadata: {
                    assistantMessageId: assistantMessage.id,
                    provider: llmProvider,
                    retrievalMode: prepared.retrievalMode,
                    chunksMatched: prepared.chunksMatched,
                    confidence: prepared.confidence,
                    outcome,
                    inputTokens: llmUsage?.inputTokens ?? null,
                    outputTokens: llmUsage?.outputTokens ?? null,
                    costUsd: llmUsage ? runCostUsd(llmUsage) : null,
                    citedSource:
                      prepared.sources.length > 0 && outcome === "deflected",
                  },
                },
              });
            }

            controller.enqueue(
              encoder.encode(
                encodeSse("done", {
                  messageId: assistantMessage.id,
                  reply: fullReply,
                }),
              ),
            );
          } else {
            controller.enqueue(
              encoder.encode(
                encodeSse("done", {
                  reply: fullReply,
                  sandbox: true,
                }),
              ),
            );
          }
          controller.close();
        } catch (streamError) {
          const databaseError = mapPrismaError(streamError);
          if (!databaseError) {
            console.error("Chat stream failed:", streamError);
          }

          if (!sandbox && prepared.conversationId && prepared.userMessageId) {
            await rollbackFailedTurn(
              prepared.conversationId,
              prepared.userMessageId,
            );
          }

          if (executionRun && prepared.userMessageId) {
            const latencyMs = Date.now() - llmRequestStartedAt;
            const agent = "support-concierge";

            // In an outage this write fails too. The visitor must still get the
            // error event below rather than a stream that dies with no reply.
            try {
              await db.executionLogEntry.create({
                data: {
                  runId: executionRun.id,
                  workspaceId: organizationId,
                  conversationId: prepared.conversationId,
                  userMessageId: prepared.userMessageId,
                  agent,
                  trigger: "widget_intake",
                  model: llmModel ?? modelForEvidence,
                  decision: "llm_stream_error",
                  latencyMs,
                  metadata: {
                    error: databaseError
                      ? databaseError.code
                      : streamError instanceof Error
                        ? streamError.message
                        : "Stream failed",
                  },
                },
              });
            } catch (logError) {
              if (!mapPrismaError(logError)) {
                console.error("Failed to log chat stream error.");
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              encodeSse("error", {
                error: STREAM_FAILED_MESSAGE,
                conversationId: prepared.conversationId,
              }),
            ),
          );
          controller.close();
        }
      },
    });

    rollbackTarget = null;

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (rollbackTarget) {
      await rollbackFailedTurn(
        rollbackTarget.conversationId,
        rollbackTarget.userMessageId,
      );
    }

    if (
      error instanceof ChatServiceError &&
      error.code === "CONVERSATION_NOT_FOUND"
    ) {
      return new Response(
        JSON.stringify({ error: error.message, conversationId }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    throw error;
  }
}

