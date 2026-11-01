import { authErrorResponse, requireOrgMembership } from "@/lib/auth";
import { parseJsonBody, readTextField } from "@/lib/api/json";
import { createMonthlyCapStreamResponse } from "@/lib/billing/cap-reply";
import { assistantCapReply } from "@/lib/billing/plans";
import { assistantAnswersCapped } from "@/lib/billing/usage";
import { ChatServiceError } from "@/lib/chat/service";
import { createChatStreamResponse } from "@/lib/chat/stream-handler";
import { validateChatMessage } from "@/lib/chat/constants";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  let conversationId: string | null = null;

  try {
    const { organization } = await requireOrgMembership();

    if (await checkRateLimit(`admin-chat:${organization.id}`, 60, 60_000)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const sandbox = body.sandbox === true;
    const conversationIdInput = readTextField(body.conversationId);
    if (conversationIdInput === null) {
      return new Response(JSON.stringify({ error: "conversationId must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    conversationId = conversationIdInput || null;

    const messageError = validateChatMessage(body.message);
    if (messageError) {
      return new Response(JSON.stringify({ error: messageError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const message = (body.message as string).trim();

    if (await assistantAnswersCapped(organization.id)) {
      if (sandbox) {
        return new Response(
          JSON.stringify({ error: assistantCapReply("ADMIN") }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }

      return await createMonthlyCapStreamResponse({
        organizationId: organization.id,
        message,
        conversationId,
        channel: "ADMIN",
      });
    }

    return await createChatStreamResponse({
      organizationId: organization.id,
      message,
      conversationId,
      channel: "ADMIN",
      sandbox,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (
      error instanceof ChatServiceError &&
      error.code === "CONVERSATION_NOT_FOUND"
    ) {
      return new Response(
        JSON.stringify({ error: error.message, conversationId }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    console.error(error);
    return new Response(
      JSON.stringify({
        error: "Chat stream failed. Check the database and try again.",
        conversationId,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
