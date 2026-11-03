import { NextResponse } from "next/server";
import { withOrgMembership } from "@/lib/auth/api";
import { parseJsonBodyLimited } from "@/lib/api/json";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { TicketPriority } from "@/lib/tickets/constants";
import {
  attachTicketTriage,
  createSupportTicket,
} from "@/lib/tickets/create-ticket";
import {
  refineEscalationTriage,
  runAfterResponse,
} from "@/lib/tickets/escalation-followup";
import { heuristicEscalationTriage } from "@/lib/tickets/escalation-triage";
import {
  parseTicketInput,
  parseTicketTake,
  TICKET_MAX_BODY_BYTES,
} from "@/lib/tickets/input";

export const maxDuration = 60;

export async function GET(request: Request) {
  return withOrgMembership(async ({ organization }) => {
    const take = parseTicketTake(new URL(request.url).searchParams.get("take"));
    const tickets = await db.ticket.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });

    return NextResponse.json({ tickets });
  });
}

export async function POST(request: Request) {
  return withOrgMembership(async ({ organization }) => {
    if (await checkRateLimit(`admin-tickets:${organization.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = await parseJsonBodyLimited<Record<string, unknown>>(
      request,
      TICKET_MAX_BODY_BYTES,
    );
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    const input = parseTicketInput(body, "MEDIUM");
    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }

    const { title, description, conversationId, requesterEmail, requesterName } =
      input.data;
    let priority: TicketPriority = input.data.priority;
    const isEscalation = title.startsWith("Escalation:");

    if (conversationId) {
      const conversation = await db.conversation.findFirst({
        where: { id: conversationId, organizationId: organization.id },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Linked conversation not found" },
          { status: 400 },
        );
      }

      if (isEscalation) {
        const existingEscalation = await db.ticket.findFirst({
          where: {
            organizationId: organization.id,
            conversationId,
            title: { startsWith: "Escalation:" },
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
        });

        if (existingEscalation) {
          return NextResponse.json({
            ticket: existingEscalation,
            duplicate: true,
          });
        }
      }
    }

    const heuristic = isEscalation
      ? heuristicEscalationTriage(title, description)
      : null;
    if (heuristic) priority = heuristic.priority;

    const ticket = await createSupportTicket({
      organizationId: organization.id,
      title,
      description,
      priority,
      conversationId,
      requesterEmail,
      requesterName,
    });

    if (!heuristic) {
      return NextResponse.json({ ticket });
    }

    // Keyword triage now; a model triage may refine it after the response.
    const updated = await attachTicketTriage(ticket.id, heuristic);
    await runAfterResponse(async () => {
      await refineEscalationTriage({ ticketId: ticket.id, title, description, heuristic });
    });
    return NextResponse.json({ ticket: updated ?? ticket });
  });
}
