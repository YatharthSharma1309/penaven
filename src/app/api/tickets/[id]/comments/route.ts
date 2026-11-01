import { NextResponse } from "next/server";
import { withOrgMembership } from "@/lib/auth/api";
import { parseJsonBodyLimited } from "@/lib/api/json";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseCommentContent, TICKET_MAX_BODY_BYTES } from "@/lib/tickets/input";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withOrgMembership(async ({ organization, user }) => {
    const { id } = await context.params;

    if (await checkRateLimit(`ticket-comments:${organization.id}`, 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await parseJsonBodyLimited(request, TICKET_MAX_BODY_BYTES);
    if ("error" in parsed) return parsed.error;

    const input = parseCommentContent(parsed.data.content);
    if ("error" in input) {
      return NextResponse.json({ error: input.error }, { status: 400 });
    }
    const { content } = input;

    const ticket = await db.ticket.findFirst({
      where: { id, organizationId: organization.id },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const comment = await db.ticketComment.create({
      data: {
        ticketId: id,
        authorId: user.id,
        content,
      },
    });

    return NextResponse.json({ comment });
  });
}
