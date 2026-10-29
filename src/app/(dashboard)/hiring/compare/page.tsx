import { redirect } from "next/navigation";
import { DemoCompareScreen } from "@/components/recruitment/demo-compare-screen";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";

type HiringComparePageProps = {
  searchParams: Promise<{ ids?: string }>;
};

export default function HiringComparePage({ searchParams }: HiringComparePageProps) {
  if (!isPublicDemoMode()) redirect("/recruitment");
  return <DemoCompareScreen searchParams={searchParams} basePath={DEMO_HIRING_PATH} />;
}
