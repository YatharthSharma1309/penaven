import { redirect } from "next/navigation";
import { PUBLIC_DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";

/** /demo has no screen of its own; the public sample lives at /demo/hiring. */
export default function DemoIndexPage() {
  redirect(PUBLIC_DEMO_HIRING_PATH);
}
