import { NextResponse } from "next/server";
import {
  getWidgetKeyFromRequest,
  resolveWidgetOrganization,
  widgetAuthErrorResponse,
} from "@/lib/auth/widget";
import { assertWidgetVisitor } from "@/lib/auth/widget-visitor";
import { parseJsonBody } from "@/lib/api/json";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { TicketPriority } from "@/lib/tickets/constants";
import {
  attachTicketTriage,
  createSupportTicket,
} from "@/lib/tickets/create-ticket";
import {
  heuristicEscalationTriage,
  triageEscalation,
} from "@/lib/tickets/escalation-triage";
import { parseTicketInput } from "@/lib/tickets/input";

export const maxDuration = 60;

async function triageWithTimeout(title: string, description: string) {
  try {
    const result = await Promise.race([
      triageEscalation(title, description),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 8_000);
      }),
    ]);
    return result === "timeout" ? null : result;
  } catch (error) {
    console.error("Escalation triage error:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const widgetKey = getWidgetKeyFromRequest(request);
    const organization = await resolveWidgetOrganization(widgetKey, request);
    const logStartAt = Date.now();

    const ip = getClientIp(request);
    if (
      (await checkRateLimit(`widget-tickets:${organization.id}:${ip}`, 10, 60 * 60 * 1000)) ||
      (await checkRateLimit(`widget-tickets:${organization.id}`, 50, 60 * 60 * 1000))
    ) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const parsed = await parseJsonBody<Record<string, unknown>>(request);
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

    if (isEscalation) {
      priority = heuristicEscalationTriage(title, description).priority;
    }

    const ticket = await createSupportTicket({
      organizationId: organization.id,
      title,
      description,
      priority,
      conversationId,
      requesterEmail,
      requesterName,
    });

    let responseTicket = ticket;
    let triageResult = null;

    if (isEscalation) {
      triageResult =
        (await triageWithTimeout(title, description)) ??
        heuristicEscalationTriage(title, description);
      const updated = await attachTicketTriage(ticket.id, triageResult);
      if (updated) responseTicket = updated;
    }

    if (conversationId) {
      try {
        const linkedRun = await db.executionRun.findFirst({
          where: {
            workspaceId: organization.id,
            conversationId,
            trigger: "widget_intake",
          },
          orderBy: { createdAt: "desc" },
        });

        if (linkedRun) {
          await db.executionLogEntry.create({
            data: {
              runId: linkedRun.id,
              workspaceId: organization.id,
              conversationId,
              userMessageId: linkedRun.userMessageId,
              agent: triageResult ? "escalation-triage" : "ticket-updater",
              trigger: "ticket_update",
              model: triageResult?.model ?? (isEscalation ? "heuristic" : "N/A"),
              decision: triageResult ? "triage_ready" : "ticket_created",
              latencyMs: Date.now() - logStartAt,
              metadata: {
                ticketId: ticket.id,
                ...(triageResult
                  ? {
                      priority: triageResult.priority,
                      category: triageResult.category,
                      reasonCode: triageResult.reasonCode,
                      source: triageResult.source,
                    }
                  : {}),
              },
            },
          });
        }
      } catch (logError) {
        console.error("Failed to append ticket_created execution log", logError);
      }
    }

    return NextResponse.json({ ticket: responseTicket });
  } catch (error) {
    const widgetResponse = widgetAuthErrorResponse(error);
    if (widgetResponse) return widgetResponse;

    console.error(error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}
