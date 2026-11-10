import type { Metadata } from "next";
import { DemoHiringScreen } from "@/components/recruitment/demo-hiring-screen";
import { PUBLIC_DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";

export const metadata: Metadata = {
  alternates: { canonical: PUBLIC_DEMO_HIRING_PATH },
};

export default function DemoHiringPage() {
  return <DemoHiringScreen />;
}
