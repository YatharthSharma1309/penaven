import { NextResponse } from "next/server";
import {
  getWidgetKeyFromRequest,
  resolveWidgetOrganization,
  widgetAuthErrorResponse,
} from "@/lib/auth/widget";
import { assertWidgetVisitor } from "@/lib/auth/widget-visitor";
import { parseJsonBodyLimited } from "@/lib/api/json";
import { prismaErrorResponse } from "@/lib/api/prisma-errors";
import { db } from "@/lib/db";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { checkRateLimit, clientIpBucket } from "@/lib/rate-limit";
import type { TicketPriority } from "@/lib/tickets/constants";
import {
  attachTicketTriage,
  createSupportTicket,
} from "@/lib/tickets/create-ticket";
import {
  refineEscalationTriage,
  runAfterResponse,
} from "@/lib/tickets/escalation-followup";
import {
  heuristicEscalationTriage,
  type EscalationTriage,
} from "@/lib/tickets/escalation-triage";
import { parseTicketInput, TICKET_MAX_BODY_BYTES } from "@/lib/tickets/input";

export const maxDuration = 60;

async function appendTicketRunLog(input: {
  organizationId: string;
  conversationId: string;
  ticketId: string;
  isEscalation: boolean;
  triage: EscalationTriage | null;
  latencyMs: number;
  responseMs: number;
}) {
  try {
    const linkedRun = await db.executionRun.findFirst({
      where: {
        workspaceId: input.organizationId,
        conversationId: input.conversationId,
        trigger: "widget_intake",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!linkedRun) return;

    const { triage } = input;
    await db.executionLogEntry.create({
      data: {
        runId: linkedRun.id,
        workspaceId: input.organizationId,
        conversationId: input.conversationId,
        userMessageId: linkedRun.userMessageId,
        agent: triage ? "escalation-triage" : "ticket-updater",
        trigger: "ticket_update",
        model: triage?.model ?? (input.isEscalation ? "heuristic" : "N/A"),
        decision: triage ? "triage_ready" : "ticket_created",
        latencyMs: input.latencyMs,
        metadata: {
          ticketId: input.ticketId,
          // How long the visitor waited for the ticket. Triage runs after that.
          responseMs: input.responseMs,
          ...(triage
            ? {
                priority: triage.priority,
                category: triage.category,
                reasonCode: triage.reasonCode,
                source: triage.source,
              }
            : {}),
        },
      },
    });
  } catch (logError) {
    console.error("Failed to append ticket_created execution log", logError);
  }
}

export async function POST(request: Request) {
  try {
    const widgetKey = getWidgetKeyFromRequest(request);
    const organization = await resolveWidgetOrganization(widgetKey, request);
    const logStartAt = Date.now();

    const ip = clientIpBucket(request);
    if (
      (await checkRateLimit(`widget-tickets:${organization.id}:${ip}`, 10, 60 * 60 * 1000)) ||
      (await checkRateLimit(`widget-tickets:${organization.id}`, 50, 60 * 60 * 1000))
    ) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = await parseJsonBodyLimited<Record<string, unknown>>(
      request,
      TICKET_MAX_BODY_BYTES,
    );
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const visitorId = assertWidgetVisitor(
      organization.id,
      body.visitorId,
      body.visitorToken,
    );

    const input = parseTicketInput(body, "HIGH");
    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }

    const { title, description, conversationId, requesterEmail, requesterName } =
      input.data;
    let priority: TicketPriority = input.data.priority;
    const isEscalation = title.startsWith("Escalation:");

    if (conversationId) {
      const conversation = await db.conversation.findFirst({
        where: {
          id: conversationId,
          organizationId: organization.id,
          visitorId,
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "This conversation could not be found. Refresh the page and try again." },
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

    // Keyword triage is instant, so the ticket has a priority and category
    // before the visitor gets an answer. A model triage may refine it later.
    const heuristic = isEscalation
      ? heuristicEscalationTriage(title, description)
      : null;
    if (heuristic) priority = heuristic.priority;

    // Demo tickets are visible to every visitor, so no contact details are kept.
    const publicDemo = isPublicDemoMode();
    const ticket = await createSupportTicket({
      organizationId: organization.id,
      title,
      description,
      priority,
      conversationId,
      requesterEmail: publicDemo ? null : requesterEmail,
      requesterName: publicDemo ? null : requesterName,
    });

    const responseTicket =
      (heuristic ? await attachTicketTriage(ticket.id, heuristic) : null) ?? ticket;
    const responseMs = Date.now() - logStartAt;

    // The model triage (bounded by AI_TRIAGE_TIMEOUT_MS) and the run log entry
    // run after the response, so asking for a person returns right away.
    await runAfterResponse(async () => {
      const triageStartAt = Date.now();
      const triage = heuristic
        ? await refineEscalationTriage({
            ticketId: ticket.id,
            title,
            description,
            heuristic,
          })
        : null;

      if (conversationId) {
        await appendTicketRunLog({
          organizationId: organization.id,
          conversationId,
          ticketId: ticket.id,
          isEscalation,
          triage,
          latencyMs: triage ? Date.now() - triageStartAt : responseMs,
          responseMs,
        });
      }
    });

    return NextResponse.json({ ticket: responseTicket });
  } catch (error) {
    const widgetResponse = widgetAuthErrorResponse(error);
    if (widgetResponse) return widgetResponse;

    const databaseResponse = prismaErrorResponse(error);
    if (databaseResponse) return databaseResponse;

    console.error(error);
    return NextResponse.json(
      { error: "We could not pass this to a person just now. Please try again." },
      { status: 500 },
    );
  }
}
