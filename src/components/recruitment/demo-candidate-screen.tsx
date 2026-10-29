import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CandidateCriteriaReview } from "@/components/recruitment/candidate-criteria-review";
import { DemoDecisionBar } from "@/components/recruitment/demo-decision-bar";
import { InterviewQuestionList } from "@/components/recruitment/interview-question-list";
import { RequirementChecklist } from "@/components/recruitment/requirement-checklist";
import { CRITERIA_REVIEW_MEANING } from "@/components/recruitment/score-badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildReviewNarrative } from "@/lib/recruitment/review-narrative";
import {
  demoCandidates,
  demoHiringJob,
  getDemoCandidate,
  PUBLIC_DEMO_HIRING_PATH,
} from "@/lib/recruitment/demo-sample";

type DemoCandidateScreenProps = {
  params: Promise<{ candidateId: string }>;
  basePath?: string;
};

export async function DemoCandidateScreen({
  params,
  basePath = PUBLIC_DEMO_HIRING_PATH,
}: DemoCandidateScreenProps) {
  const { candidateId } = await params;
  const candidate = getDemoCandidate(candidateId);
  if (!candidate?.review || !candidate.analysis) notFound();

  const narrative = buildReviewNarrative({
    requirements: candidate.review.requirements,
    preferredEvidence: candidate.analysis.scoreBreakdown.preferredSkillEvidence,
  });
  const compareIds = [
    candidate.id,
    ...demoCandidates.filter((item) => item.id !== candidate.id).map((item) => item.id),
  ].slice(0, 3);

  return (
    <>
      <Header
        title={candidate.displayName}
        description={`${demoHiringJob.clientName} · ${demoHiringJob.title}. The lines sit next to each requirement. You still decide who moves forward.`}
        action={
          <Link
            href={basePath}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sample job
          </Link>
        }
      />
      <main id="main-content" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3 sm:px-6">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="text-sm font-semibold text-foreground">Requirement evidence</h3>
            <p className="mt-1 mb-3 text-sm leading-6 text-muted">
              Each requirement sits next to the resume line that supports it.
            </p>
            <RequirementChecklist rows={candidate.review.requirements} />
            <div className="mt-6">
              <CandidateCriteriaReview
                score={candidate.matchScore}
                disclaimer={CRITERIA_REVIEW_MEANING}
                supporting={narrative.supporting}
                furtherReview={narrative.furtherReview}
                hideSupporting
              />
            </div>
          </Card>
          <InterviewQuestionList questions={candidate.analysis.interviewQuestions} />
          <Card>
            <CardTitle>Sample resume</CardTitle>
            <CardDescription>
              Fictional text, included so you can check the evidence against the source.
            </CardDescription>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs leading-6 text-slate-700">
              {candidate.rawText}
            </pre>
          </Card>
        </div>
        <Card className="h-fit">
          <CardTitle>Next action</CardTitle>
          <p className="mt-1 text-sm leading-6 text-slate-600">Compare, shortlist, or reject.</p>
          <div className="mt-4">
            <DemoDecisionBar
              candidateId={candidate.id}
              displayName={candidate.displayName}
              fallbackStatus={candidate.status}
              compareIds={compareIds}
              basePath={basePath}
            />
          </div>
        </Card>
      </main>
    </>
  );
}
