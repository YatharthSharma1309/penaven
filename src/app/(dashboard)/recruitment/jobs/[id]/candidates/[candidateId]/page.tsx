import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CandidateDetailPanel } from "@/components/recruitment/candidate-detail-panel";
import { CandidateCriteriaReview } from "@/components/recruitment/candidate-criteria-review";
import { InterviewQuestionList } from "@/components/recruitment/interview-question-list";
import { InterviewScorecardPanel } from "@/components/recruitment/interview-scorecard-panel";
import { RequirementChecklist } from "@/components/recruitment/requirement-checklist";
import { CRITERIA_REVIEW_MEANING } from "@/components/recruitment/score-badge";
import { Badge } from "@/components/ui/badge";
import { buildRequirementRows } from "@/lib/recruitment/requirement-rows";
import { buildReviewNarrative } from "@/lib/recruitment/review-narrative";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { getCandidateDetail } from "@/lib/recruitment/services/candidates";
import { getJobDetail } from "@/lib/recruitment/services/jobs";

type CandidateDetailPageProps = {
  params: Promise<{ id: string; candidateId: string }>;
};

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id: jobId, candidateId } = await params;
  const { organization } = await requireOrgMembershipOrRedirect();

  const [job, candidate] = await Promise.all([
    getJobDetail(organization.id, jobId),
    getCandidateDetail(organization.id, candidateId),
  ]);

  if (!job || !candidate || candidate.jobId !== jobId) {
    notFound();
  }

  const otherCandidateCount = job.candidates.filter(
    (item) => item.id !== candidate.id && item.status !== "archived" && item.status !== "hired",
  ).length;

  const analysis = candidate.analysis;
  const requirementRows = analysis
    ? buildRequirementRows({
        requiredSkills: job.requiredSkills,
        breakdown: analysis.scoreBreakdown,
      })
    : [];
  const narrative = analysis
    ? buildReviewNarrative({
        requirements: requirementRows,
        preferredEvidence: analysis.scoreBreakdown.preferredSkillEvidence,
      })
    : null;
  const compareIds = [
    candidate.id,
    ...job.candidates
      .filter((item) => item.id !== candidate.id && item.hasAnalysis)
      .map((item) => item.id),
  ].slice(0, 3);
  const compareHref =
    compareIds.length >= 2
      ? `/recruitment/jobs/${jobId}/compare?ids=${encodeURIComponent(compareIds.join(","))}`
      : null;

  return (
    <>
      <Header
        title={candidate.displayName}
        description={
          job.clientName
            ? `${job.clientName} · ${job.title}. The lines sit next to each requirement. You still decide who moves forward.`
            : `${job.title}. The lines sit next to each requirement. You still decide who moves forward.`
        }
        action={
          <Link
            href={`/recruitment/jobs/${jobId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-900 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to job
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              {narrative ? (
                <>
                {requirementRows.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-foreground">
                      Requirement evidence
                    </h3>
                    <p className="mt-1 mb-3 text-sm leading-6 text-muted">
                      Each requirement sits next to the resume line that supports it.
                    </p>
                    <RequirementChecklist rows={requirementRows} />
                  </div>
                ) : null}
                <CandidateCriteriaReview
                  score={analysis?.matchScore ?? candidate.matchScore}
                  disclaimer={CRITERIA_REVIEW_MEANING}
                  supporting={narrative.supporting}
                  furtherReview={narrative.furtherReview}
                />
                </>
              ) : (
                <p className="text-sm text-muted">
                  Run analysis to review this candidate against the job criteria.
                </p>
              )}

              {analysis ? (
                <details className="mt-6 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700">
                    Score points and extracted skills
                  </summary>
                  <div className="mt-4 space-y-5">
                    {analysis.summary ? (
                      <p className="leading-6 text-slate-600">{analysis.summary}</p>
                    ) : null}
                    {analysis.extractedSkills.length > 0 ? (
                      <div>
                        <p className="font-medium text-slate-700">Extracted skills</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {analysis.extractedSkills.map((skill) => (
                            <Badge key={skill} tone="info">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-2 text-slate-600 sm:grid-cols-3">
                      <div>
                        <dt>Required skills</dt>
                        <dd className="font-semibold text-slate-900">
                          {analysis.scoreBreakdown.requiredSkills}/50
                        </dd>
                      </div>
                      <div>
                        <dt>Preferred skills</dt>
                        <dd className="font-semibold text-slate-900">
                          {analysis.scoreBreakdown.preferredSkills}/15
                        </dd>
                      </div>
                      <div>
                        <dt>Role alignment</dt>
                        <dd className="font-semibold text-slate-900">
                          {analysis.scoreBreakdown.roleAlignment}/10
                        </dd>
                      </div>
                      <div>
                        <dt>Experience</dt>
                        <dd className="font-semibold text-slate-900">
                          {analysis.scoreBreakdown.experience}/10
                        </dd>
                      </div>
                      <div>
                        <dt>Education & certs</dt>
                        <dd className="font-semibold text-slate-900">
                          {analysis.scoreBreakdown.educationCertifications}/10
                        </dd>
                      </div>
                      <div>
                        <dt>Penalties</dt>
                        <dd className="font-semibold text-rose-600">
                          -{analysis.scoreBreakdown.penalties}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </details>
              ) : null}
            </Card>

            <InterviewQuestionList questions={analysis?.interviewQuestions ?? []} />

            <InterviewScorecardPanel
              candidateId={candidate.id}
              candidateName={candidate.displayName}
              requiredSkills={job.requiredSkills}
              interviewQuestions={analysis?.interviewQuestions ?? []}
              missingSkills={analysis?.missingSkills ?? []}
              initialScorecard={candidate.interviewScorecard}
            />

            <Card>
              <CardTitle>Resume text</CardTitle>
              <CardDescription>
                {candidate.fileName
                  ? `Source: ${candidate.fileName} (${candidate.parseStatus})`
                  : `Manually entered (${candidate.parseStatus})`}
              </CardDescription>
              {candidate.hasOriginalFile ? (
                <a
                  href={`/api/recruitment/candidates/${candidate.id}/file`}
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                    className: "mt-3",
                  })}
                >
                  Download original file
                </a>
              ) : null}
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs leading-6 text-slate-700">
                {candidate.rawText}
              </pre>
            </Card>
          </div>

          <Card>
            <CardTitle>Next action</CardTitle>
            <p className="mt-1 text-sm leading-6 text-slate-600">Compare, shortlist, or reject.</p>
            <div className="mt-4">
              <CandidateDetailPanel
                candidate={candidate}
                otherCandidateCount={otherCandidateCount}
                compareHref={compareHref}
              />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
