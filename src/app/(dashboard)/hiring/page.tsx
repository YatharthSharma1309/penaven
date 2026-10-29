import { redirect } from "next/navigation";
import { DemoHiringScreen } from "@/components/recruitment/demo-hiring-screen";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";

export default function HiringPage() {
  if (!isPublicDemoMode()) redirect("/recruitment");
  return <DemoHiringScreen basePath={DEMO_HIRING_PATH} />;
}
