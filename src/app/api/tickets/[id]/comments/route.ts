import { NextResponse } from "next/server";
import { withOrgMembership } from "@/lib/auth/api";
import { parseJsonBody, readTextField } from "@/lib/api/json";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withOrgMembership(async ({ organization, user }) => {
    const { id } = await context.params;

    if (await checkRateLimit(`ticket-comments:${organization.id}`, 60, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const content = readTextField(parsed.data.content);

    if (content === null) {
      return NextResponse.json(
        { error: "Comment content must be a string" },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 },
      );
    }

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
