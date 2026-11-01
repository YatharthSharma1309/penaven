import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requireOrgMembership,
  type OrgMembershipContext,
} from "@/lib/auth";
import { ChatServiceError } from "@/lib/chat/service";

import { Prisma } from "@/generated/prisma/client";

function mapHandlerError(error: unknown) {
  if (error instanceof ChatServiceError) {
    const statusByCode: Record<ChatServiceError["code"], number> = {
      CONVERSATION_NOT_FOUND: 404,
      INVALID_MESSAGE: 400,
      AI_UNAVAILABLE: 503,
      AI_FAILED: 502,
      MONTHLY_CAP_REACHED: 402,
    };

    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusByCode[error.code] ?? 500 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json(
      { error: "A database constraint was violated." },
      { status: 409 },
    );
  }

  return null;
}

export async function withOrgMembership<T>(
  handler: (context: OrgMembershipContext) => Promise<T>,
) {
  try {
    const context = await requireOrgMembership();
    return await handler(context);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    const mapped = mapHandlerError(error);
    if (mapped) return mapped;

    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function withAdminMembership<T>(
  handler: (context: OrgMembershipContext) => Promise<T>,
) {
  try {
    const context = await requireOrgMembership("ADMIN");
    return await handler(context);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    const mapped = mapHandlerError(error);
    if (mapped) return mapped;

    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
