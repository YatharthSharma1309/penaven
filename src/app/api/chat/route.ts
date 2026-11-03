import { NextResponse } from "next/server";
import { authErrorResponse, requireOrgMembership } from "@/lib/auth";
import { parseJsonBody } from "@/lib/api/json";
import { prismaErrorResponse } from "@/lib/api/prisma-errors";
import {
  ChatServiceError,
  generateChatReply,
  prepareChatTurn,
  prepareSandboxChatTurn,
  rollbackFailedTurn,
  saveAssistantMessage,
} from "@/lib/chat/service";
import { demoAdminChatRefusal } from "@/lib/billing/abuse-limits";
import { assistantCapReply } from "@/lib/billing/plans";
import { assistantAnswersCapped } from "@/lib/billing/usage";
import { parseChatInput } from "@/lib/chat/input";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let conversationId: string | null = null;
  let userMessageId: string | null = null;
  let preparedConversationId: string | null = null;

  try {
    const { organization } = await requireOrgMembership();

    if (await checkRateLimit(`admin-chat:${organization.id}`, 60, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const sandbox = body.sandbox === true;
    const input = parseChatInput(body);
    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }
    const { message } = input;
    conversationId = input.conversationId;

    const demoRefusal = await demoAdminChatRefusal(request, organization.id, sandbox);
    if (demoRefusal) return demoRefusal;

    if (await assistantAnswersCapped(organization.id)) {
      return NextResponse.json(
        { error: assistantCapReply("ADMIN") },
        { status: 402 },
      );
    }

    if (sandbox) {
      const prepared = await prepareSandboxChatTurn(organization.id, message);
      const reply = await generateChatReply(
        organization.id,
        message,
        prepared.rankedChunks,
        prepared.fallbackReply,
      );

      return NextResponse.json({
        reply,
        sources: prepared.sources,
        retrievalMode: prepared.retrievalMode,
        chunksMatched: prepared.chunksMatched,
        confidence: prepared.confidence,
        sandbox: true,
      });
    }

    const prepared = await prepareChatTurn(
      organization.id,
      message,
      conversationId,
      { channel: "ADMIN" },
    );

    preparedConversationId = prepared.conversationId;
    userMessageId = prepared.userMessageId;
    conversationId = prepared.conversationId;

    const reply = await generateChatReply(
      organization.id,
      message,
      prepared.rankedChunks,
      prepared.fallbackReply,
    );

    const assistantMessage = await saveAssistantMessage(
      prepared.conversationId,
      reply,
      prepared.sources,
    );

    return NextResponse.json({
      conversationId: prepared.conversationId,
      messageId: assistantMessage.id,
      reply,
      sources: prepared.sources,
      retrievalMode: prepared.retrievalMode,
      chunksMatched: prepared.chunksMatched,
      confidence: prepared.confidence,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (userMessageId && preparedConversationId) {
      await rollbackFailedTurn(preparedConversationId, userMessageId);
    }

    if (
      error instanceof ChatServiceError &&
      error.code === "MONTHLY_CAP_REACHED"
    ) {
      return NextResponse.json(
        { error: assistantCapReply("ADMIN") },
        { status: 402 },
      );
    }

    if (
      error instanceof ChatServiceError &&
      error.code === "CONVERSATION_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: error.message, conversationId },
        { status: 404 },
      );
    }

    const databaseResponse = prismaErrorResponse(error, { conversationId });
    if (databaseResponse) return databaseResponse;

    console.error(error);
    return NextResponse.json(
      {
        error: "Chat request failed. Check the database and try again.",
        conversationId,
      },
      { status: 500 },
    );
  }
}
