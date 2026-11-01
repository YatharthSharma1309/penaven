import { NextResponse } from "next/server";
import { withOrgMembership } from "@/lib/auth/api";
import { parseJsonBody } from "@/lib/api/json";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withOrgMembership(async ({ organization }) => {
    if (await checkRateLimit(`admin-feedback:${organization.id}`, 60, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { id } = await context.params;

    const parsed = await parseJsonBody(request);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body.helpful !== "boolean") {
      return NextResponse.json(
        { error: "helpful must be a boolean" },
        { status: 400 },
      );
    }

    const message = await db.message.findFirst({
      where: {
        id,
        role: "ASSISTANT",
        conversation: { organizationId: organization.id },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updated = await db.message.update({
      where: { id },
      data: { helpful: body.helpful },
    });

    return NextResponse.json({ message: updated });
  });
}
