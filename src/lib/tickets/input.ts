import { readTextField } from "@/lib/api/json";
import { isValidEmail } from "@/lib/contact/validation";
import {
  isTicketPriority,
  TICKET_LIMITS,
  type TicketPriority,
} from "@/lib/tickets/constants";

/** Fits the longest allowed ticket or comment, even if every character is escaped. */
export const TICKET_MAX_BODY_BYTES = 64 * 1024;

const MAX_TICKETS_LISTED = 200;

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
  if (title.length > TICKET_LIMITS.title) {
    return { error: `Title must be ${TICKET_LIMITS.title} characters or fewer` };
  }

  const description = readTextField(body.description);
  if (description === null) return { error: "Description must be a string" };
  if (description.length > TICKET_LIMITS.description) {
    return {
      error: `Description must be ${TICKET_LIMITS.description} characters or fewer`,
    };
  }

  const priority = body.priority ?? defaultPriority;
  if (typeof priority !== "string" || !isTicketPriority(priority)) {
    return { error: "Invalid ticket priority" };
  }

  const conversationId = readTextField(body.conversationId);
  if (conversationId === null) return { error: "conversationId must be a string" };

  const requesterName = readTextField(body.requesterName);
  if (requesterName === null) return { error: "requesterName must be a string" };
  if (requesterName.length > TICKET_LIMITS.requesterName) {
    return {
      error: `requesterName must be ${TICKET_LIMITS.requesterName} characters or fewer`,
    };
  }

  const requesterEmail = readTextField(body.requesterEmail);
  if (requesterEmail === null || (requesterEmail && !isValidEmail(requesterEmail))) {
    return { error: "Enter a valid requester email" };
  }

  return {
    data: {
      title,
      description: description || title,
      priority,
      conversationId: conversationId || null,
      requesterEmail: requesterEmail || null,
      requesterName: requesterName || null,
    },
  };
}

/** Reads a ticket comment for the comments route. */
export function parseCommentContent(
  value: unknown,
): { content: string } | { error: string } {
  const content = readTextField(value);
  if (content === null) return { error: "Comment content must be a string" };
  if (!content) return { error: "Comment content is required" };
  if (content.length > TICKET_LIMITS.comment) {
    return { error: `Comment must be ${TICKET_LIMITS.comment} characters or fewer` };
  }
  return { content };
}

/** Reads `?take=` for the ticket list. A missing or unusable value gets the full 200. */
export function parseTicketTake(value: string | null) {
  const take = value && /^\d+$/.test(value) ? Number(value) : 0;
  return take >= 1 ? Math.min(take, MAX_TICKETS_LISTED) : MAX_TICKETS_LISTED;
}
