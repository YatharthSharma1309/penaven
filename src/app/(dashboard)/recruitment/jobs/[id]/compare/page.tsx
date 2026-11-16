import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Columns2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CandidateCompareGrid } from "@/components/recruitment/candidate-compare-grid";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { getCandidatesForCompare } from "@/lib/recruitment/services/candidates";
import { getJobDetail } from "@/lib/recruitment/services/jobs";

type ComparePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
};

function parseCompareIds(raw: string | undefined) {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 3);
}

export default async function CandidateComparePage({
  params,
  searchParams,
}: ComparePageProps) {
  const { id: jobId } = await params;
  const { ids: idsParam } = await searchParams;
  const { organization } = await requireOrgMembershipOrRedirect();

  const job = await getJobDetail(organization.id, jobId);
  if (!job) {
    notFound();
  }

  const requestedIds = parseCompareIds(idsParam);
  const candidates =
    requestedIds.length >= 2
      ? await getCandidatesForCompare(organization.id, jobId, requestedIds)
      : [];

  const analyzed = candidates.filter((candidate) => candidate.hasAnalysis);

  return (
    <>
      <Header
        title="Compare candidates"
        description={`Side-by-side shortlist for ${job.title}`}
        action={
          <Link
            href={`/recruitment/jobs/${jobId}`}
            className={buttonClassName({ variant: "secondary", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to job
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {analyzed.length < 2 ? (
          <EmptyState
            icon={Columns2}
            title="Pick 2–3 analyzed candidates"
            description="From the job pipeline, select analyzed resumes and click Compare to shortlist side by side."
            action={
              <Link
                href={`/recruitment/jobs/${jobId}`}
                className={buttonClassName({ size: "sm" })}
              >
                Open pipeline
              </Link>
            }
          />
        ) : (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Comparing {analyzed.length} candidates
                </p>
                <p className="mt-1 text-sm text-muted">
                  The same required skills, in the same order, on every card.
                  The number is a criteria review, not a chance someone will succeed.
                </p>
              </div>
              <p className="text-xs text-muted">
                Required skills: {job.requiredSkills.join(", ") || "None listed"}
              </p>
            </Card>

            <CandidateCompareGrid
              jobId={jobId}
              requiredSkills={job.requiredSkills}
              candidates={analyzed}
            />
          </>
        )}
      </main>
    </>
  );
}
