import { readTextField } from "@/lib/api/json";
import { validateChatMessage } from "@/lib/chat/constants";

/** Reads the turn fields shared by the admin and widget chat routes. */
export function parseChatInput(
  body: Record<string, unknown>,
): { message: string; conversationId: string | null } | { error: string } {
  const conversationId = readTextField(body.conversationId);
  if (conversationId === null) return { error: "conversationId must be a string" };

  const messageError = validateChatMessage(body.message);
  if (messageError) return { error: messageError };

  return {
    message: (body.message as string).trim(),
    conversationId: conversationId || null,
  };
}
