import { assistantCapReply } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { ChatServiceError } from "@/lib/chat/service";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Persist the visitor's message and a handoff line, without calling the model. */
export async function createMonthlyCapStreamResponse(input: {
  organizationId: string;
  message: string;
  conversationId: string | null;
  visitorId?: string | null;
  channel: "WIDGET" | "HELP_CENTER" | "ADMIN";
}) {
  let conversationId = input.conversationId;

  if (conversationId) {
    const existing = await db.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: input.organizationId,
        ...(input.visitorId ? { visitorId: input.visitorId } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      throw new ChatServiceError(
        "Conversation not found.",
        "CONVERSATION_NOT_FOUND",
      );
    }
  } else {
    const created = await db.conversation.create({
      data: {
        organizationId: input.organizationId,
        title: input.message.slice(0, 80),
        visitorId: input.visitorId ?? null,
        channel: input.channel,
      },
    });
    conversationId = created.id;
  }

  const reply = assistantCapReply(input.channel);

  const userMessage = await db.message.create({
    data: {
      conversationId,
      role: "USER",
      content: input.message,
    },
  });

  const assistant = await db.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: reply,
      sources: [],
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const body = [
    encodeSse("meta", {
      conversationId,
      userMessageId: userMessage.id,
      sources: [],
      retrievalMode: "monthly_cap",
      chunksMatched: 0,
      confidence: "low",
    }),
    encodeSse("token", { text: reply }),
    encodeSse("done", {
      messageId: assistant.id,
      reply,
    }),
  ].join("");

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
