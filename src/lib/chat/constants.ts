/** Maximum characters accepted per chat message (admin + widget). */
export const MAX_CHAT_MESSAGE_LENGTH = 4_000;

export function validateChatMessage(message: unknown): string | null {
  if (message === undefined || message === null) return "Message is required";
  if (typeof message !== "string") return "Message must be a string";

  const trimmed = message.trim();
  if (!trimmed) return "Message is required";
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`;
  }
  return null;
}
