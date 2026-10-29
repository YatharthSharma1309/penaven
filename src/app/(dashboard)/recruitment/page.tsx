import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Header } from "@/components/layout/header";
import { JobCard } from "@/components/recruitment/job-card";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { listJobs } from "@/lib/recruitment/services/jobs";

export default async function RecruitmentPage() {
  const { organization } = await requireOrgMembershipOrRedirect();
  const jobs = await listJobs(organization.id);

  return (
    <>
      <Header
        title="Hiring"
        description="Open a role for a client, read each requirement next to the resume line, and decide who moves forward."
        action={
          <Link href="/recruitment/jobs/new" className={buttonClassName({ size: "sm" })}>
            New job
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs yet"
            description="Create your first job posting to start collecting and analyzing candidate resumes."
            action={
              <Link href="/recruitment/jobs/new" className={buttonClassName()}>
                Create job
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
