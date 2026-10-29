import { redirect } from "next/navigation";
import { DemoCandidateScreen } from "@/components/recruitment/demo-candidate-screen";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";

type HiringCandidatePageProps = {
  params: Promise<{ candidateId: string }>;
};

export default function HiringCandidatePage({ params }: HiringCandidatePageProps) {
  if (!isPublicDemoMode()) redirect("/recruitment");
  return <DemoCandidateScreen params={params} basePath={DEMO_HIRING_PATH} />;
}
