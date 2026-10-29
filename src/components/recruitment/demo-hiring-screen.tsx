import Link from "next/link";
import { Header } from "@/components/layout/header";
import { DemoPipeline, DemoSampleSummary } from "@/components/recruitment/demo-pipeline";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  DEMO_SHARE_EXPORT_PATH,
  DEMO_SHARE_PATH,
  demoCandidates,
  demoCompareHref,
  demoHiringJob,
  PUBLIC_DEMO_HIRING_PATH,
} from "@/lib/recruitment/demo-sample";

type DemoHiringScreenProps = {
  basePath?: string;
};

export function DemoHiringScreen({
  basePath = PUBLIC_DEMO_HIRING_PATH,
}: DemoHiringScreenProps) {
  return (
    <>
      <Header
        title={demoHiringJob.title}
        description="Each requirement next to the resume line. Compare Maya and Jordan, then decide who moves forward."
      />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary-soft px-4 py-3">
          <p className="text-sm leading-6 text-foreground">
            These people are fictional, and this demo does not take resume uploads. Shortlist
            and reject stay in this browser for this visit. The shortlist link is the page a
            hiring manager can open, and the CSV is the file for the tracker you already use.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={demoCompareHref(["maya-chen", "jordan-ellis"], basePath)}
              className={buttonClassName({ size: "sm", className: "min-h-11" })}
            >
              Compare Maya and Jordan
            </Link>
            <Link
              href={DEMO_SHARE_PATH}
              className={buttonClassName({ variant: "secondary", size: "sm", className: "min-h-11" })}
            >
              Open the shortlist
            </Link>
            <a
              href={DEMO_SHARE_EXPORT_PATH}
              className={buttonClassName({ variant: "secondary", size: "sm", className: "min-h-11" })}
            >
              Export CSV
            </a>
          </div>
        </div>

        <Card>
          <CardTitle>Job criteria</CardTitle>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-medium">Client:</span> {demoHiringJob.clientName}
          </p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-700">Required skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {demoHiringJob.requiredSkills.map((skill) => (
                  <Badge key={skill} tone="info">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-700">Preferred skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {demoHiringJob.preferredSkills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </div>
            <p className="text-slate-600">
              <span className="font-medium text-slate-700">Level:</span>{" "}
              {demoHiringJob.experienceLevel} ({demoHiringJob.minYearsExperience}+ years)
            </p>
            <p className="text-slate-600">
              <span className="font-medium text-slate-700">Type:</span> {demoHiringJob.roleType}
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{demoHiringJob.description}</p>
          <DemoSampleSummary candidates={demoCandidates} />
        </Card>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Candidates</h2>
          <DemoPipeline candidates={demoCandidates} basePath={basePath} />
        </section>
      </main>
    </>
  );
}
