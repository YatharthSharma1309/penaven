import { DemoCandidateScreen } from "@/components/recruitment/demo-candidate-screen";

type DemoCandidatePageProps = {
  params: Promise<{ candidateId: string }>;
};

export default function DemoCandidatePage({ params }: DemoCandidatePageProps) {
  return <DemoCandidateScreen params={params} />;
}
