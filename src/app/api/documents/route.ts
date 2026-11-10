import { NextResponse } from "next/server";
import { withOrgMembership } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { failStaleProcessingDocuments } from "@/lib/documents/stale";

export async function GET() {
  return withOrgMembership(async ({ organization }) => {
    await failStaleProcessingDocuments(organization.id);

    const documents = await db.document.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  });
}
