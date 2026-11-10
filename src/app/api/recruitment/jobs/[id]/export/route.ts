import { NextResponse } from "next/server";
import { withRecruitmentOrg } from "@/lib/recruitment/api-handler";
import { exportJobCsv } from "@/lib/recruitment/services/shortlist";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return withRecruitmentOrg(async ({ organization }) => {
    const file = await exportJobCsv(organization.id, id);
    if (!file) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return new NextResponse(file.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  }, "read");
}
