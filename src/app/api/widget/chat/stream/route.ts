import {
  getWidgetKeyFromRequest,
  resolveWidgetOrganization,
  widgetAuthErrorResponse,
} from "@/lib/auth/widget";
import { assertWidgetVisitor } from "@/lib/auth/widget-visitor";
import { parseJsonBody, readTextField } from "@/lib/api/json";
import { parseChatInput } from "@/lib/chat/input";
import { answerSafetyLimitReached } from "@/lib/billing/abuse-limits";
import { createMonthlyCapStreamResponse } from "@/lib/billing/cap-reply";
import { assistantAnswersCapped } from "@/lib/billing/usage";
import { ChatServiceError } from "@/lib/chat/service";
import { createChatStreamResponse } from "@/lib/chat/stream-handler";
import { checkRateLimit, clientIpBucket } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  let conversationId: string | null = null;

  try {
    const widgetKey = getWidgetKeyFromRequest(request);
    const organization = await resolveWidgetOrganization(widgetKey, request);

    const ip = clientIpBucket(request);
    if (
      (await checkRateLimit(`widget-chat:${organization.id}:${ip}`, 30, 60_000)) ||
      (await checkRateLimit(`widget-chat:${organization.id}`, 200, 60_000))
    ) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const visitorId = assertWidgetVisitor(
      organization.id,
      body.visitorId,
      body.visitorToken,
    );

    const channelInput = readTextField(body.channel);
    if (channelInput === null) {
      return Response.json({ error: "channel must be a string" }, { status: 400 });
    }
    const channel =
      channelInput.toUpperCase() === "HELP_CENTER"
        ? "HELP_CENTER"
        : ("WIDGET" as const);

    const input = parseChatInput(body);
    if ("error" in input) {
      return Response.json({ error: input.error }, { status: 400 });
    }
    const { message } = input;
    conversationId = input.conversationId;

    if (await assistantAnswersCapped(organization.id)) {
      return await createMonthlyCapStreamResponse({
        organizationId: organization.id,
        message,
        conversationId,
        visitorId,
        channel,
      });
    }

    if (await answerSafetyLimitReached(request, organization.id)) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    return await createChatStreamResponse({
      organizationId: organization.id,
      message,
      conversationId,
      visitorId,
      channel,
    });
  } catch (error) {
    const widgetResponse = widgetAuthErrorResponse(error);
    if (widgetResponse) return widgetResponse;

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
        error: "Widget chat stream failed.",
        conversationId,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
