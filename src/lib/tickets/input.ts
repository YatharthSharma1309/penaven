import { readTextField } from "@/lib/api/json";
import { isValidEmail } from "@/lib/contact/validation";
import { isTicketPriority, type TicketPriority } from "@/lib/tickets/constants";

export type TicketInput = {
  title: string;
  description: string;
  priority: TicketPriority;
  conversationId: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
};

/** Reads the ticket fields shared by the admin and widget create routes. */
export function parseTicketInput(
  body: Record<string, unknown>,
  defaultPriority: TicketPriority,
): { data: TicketInput } | { error: string } {
  const title = readTextField(body.title);
  if (title === null) return { error: "Title must be a string" };
  if (!title) return { error: "Title is required" };

  const description = readTextField(body.description);
  if (description === null) return { error: "Description must be a string" };

  const priority = body.priority ?? defaultPriority;
  if (typeof priority !== "string" || !isTicketPriority(priority)) {
    return { error: "Invalid ticket priority" };
  }

  const conversationId = readTextField(body.conversationId);
  if (conversationId === null) return { error: "conversationId must be a string" };

  const requesterName = readTextField(body.requesterName);
  if (requesterName === null) return { error: "requesterName must be a string" };

  const requesterEmail = readTextField(body.requesterEmail);
  if (requesterEmail === null || (requesterEmail && !isValidEmail(requesterEmail))) {
    return { error: "Enter a valid requester email" };
  }

  const fallbackDescription = title.startsWith("Escalation:")
    ? title
    : `Escalation request: ${title}`;

  return {
    data: {
      title,
      description: description || fallbackDescription,
      priority,
      conversationId: conversationId || null,
      requesterEmail: requesterEmail || null,
      requesterName: requesterName || null,
    },
  };
}
