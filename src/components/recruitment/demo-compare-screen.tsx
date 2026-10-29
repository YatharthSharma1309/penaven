import Link from "next/link";
import { ArrowLeft, Columns2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { DemoCompareView } from "@/components/recruitment/demo-compare-view";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  demoHiringJob,
  getDemoCandidatesByIds,
  PUBLIC_DEMO_HIRING_PATH,
} from "@/lib/recruitment/demo-sample";

type DemoCompareScreenProps = {
  searchParams: Promise<{ ids?: string }>;
  basePath?: string;
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

function listedNames(names: string[]) {
  if (names.length < 2) return "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export async function DemoCompareScreen({
  searchParams,
  basePath = PUBLIC_DEMO_HIRING_PATH,
}: DemoCompareScreenProps) {
  const { ids: idsParam } = await searchParams;
  const candidates = getDemoCandidatesByIds(parseCompareIds(idsParam));
  const names = listedNames(candidates.map((candidate) => candidate.displayName));

  return (
    <>
      <Header
        title="Compare sample candidates"
        description={
          names
            ? `${names} on the same requirements for ${demoHiringJob.title}.`
            : `Same criteria for ${demoHiringJob.title}. Choose two or three people.`
        }
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
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {candidates.length < 2 ? (
          <EmptyState
            icon={Columns2}
            title="Select two or three candidates"
            description="Go back to the sample job and choose who to compare."
            action={
              <Link href={basePath} className={buttonClassName()}>
                Back to sample job
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <DemoCompareView
              requiredSkills={[...demoHiringJob.requiredSkills]}
              candidates={candidates}
              basePath={basePath}
            />
          </div>
        )}
      </main>
    </>
  );
}
