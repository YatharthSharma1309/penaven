import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CandidatePipelineTable } from "@/components/recruitment/candidate-pipeline-table";
import { JobActivityLog } from "@/components/recruitment/job-activity-log";
import { ManualCandidateForm } from "@/components/recruitment/manual-candidate-form";
import { PendingHireBanner } from "@/components/recruitment/pending-hire-banner";
import { ResumeUploader } from "@/components/recruitment/resume-uploader";
import { ShortlistHandoff } from "@/components/recruitment/shortlist-handoff";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { listJobAuditEvents } from "@/lib/recruitment/services/audit";
import { getJobDetail } from "@/lib/recruitment/services/jobs";
import { Users } from "lucide-react";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const { organization } = await requireOrgMembershipOrRedirect();
  const job = await getJobDetail(organization.id, id);

  if (!job) {
    notFound();
  }

  const activityEvents = await listJobAuditEvents(organization.id, id);

  const activeCandidates = job.candidates.filter(
    (candidate) => candidate.status !== "archived",
  );

  return (
    <>
      <Header
        title={job.title}
        description="Read each requirement next to the resume line, compare people, then decide who moves forward."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ShortlistHandoff jobId={job.id} />
            <Link
              href={`/recruitment/jobs/${job.id}/edit`}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              <Pencil className="h-4 w-4" />
              Edit job
            </Link>
          </div>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {job.pendingHire ? (
          <PendingHireBanner jobId={job.id} pendingHire={job.pendingHire} />
        ) : null}

        <Card>
          <CardTitle>Job criteria</CardTitle>
          {job.clientName ? (
            <p className="mt-2 text-sm text-foreground">
              <span className="font-medium">Client:</span> {job.clientName}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Add a client so the shortlist names who the role is for.</p>
          )}
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-700">Required skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.requiredSkills.map((skill) => (
                  <Badge key={skill} tone="info">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            {job.preferredSkills.length > 0 ? (
              <div>
                <p className="font-medium text-slate-700">Preferred skills</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.preferredSkills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {job.experienceLevel ? (
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Level:</span>{" "}
                {job.experienceLevel}
                {job.minYearsExperience !== null
                  ? ` (${job.minYearsExperience}+ years)`
                  : ""}
              </p>
            ) : null}
            {job.roleType ? (
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Type:</span> {job.roleType}
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{job.description}</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Every candidate on this job is reviewed against these requirements.
          </p>
        </Card>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Candidates</h2>

          {activeCandidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates yet"
              description="Upload resumes or add candidate text. The original file is kept with each person."
            />
          ) : (
            <CandidatePipelineTable jobId={job.id} candidates={activeCandidates} />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Add candidates</CardTitle>
            <div className="mt-4 space-y-4">
              <ResumeUploader jobId={job.id} />
              <ManualCandidateForm jobId={job.id} />
            </div>
          </Card>

          <Card>
            <CardTitle>Pipeline summary</CardTitle>
            {job.candidateStats ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Active</dt>
                  <dd className="text-lg font-semibold text-slate-900">
                    {job.candidateStats.activeTotal}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Analyzed</dt>
                  <dd className="text-lg font-semibold text-slate-900">
                    {job.candidateStats.analyzed}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pending analysis</dt>
                  <dd className="text-lg font-semibold text-amber-600">
                    {job.candidateStats.pendingAnalysis}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Parse failed</dt>
                  <dd className="text-lg font-semibold text-rose-600">
                    {job.candidateStats.parseFailed}
                  </dd>
                </div>
              </dl>
            ) : null}
          </Card>
        </div>

        <JobActivityLog events={activityEvents} />
      </main>
    </>
  );
}
