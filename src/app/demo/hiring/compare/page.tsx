import { DemoCompareScreen } from "@/components/recruitment/demo-compare-screen";

type DemoComparePageProps = {
  searchParams: Promise<{ ids?: string }>;
};

export default function DemoComparePage({ searchParams }: DemoComparePageProps) {
  return <DemoCompareScreen searchParams={searchParams} />;
}
