import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-blue-900">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
        The page you are looking for does not exist or is not available in this
        workspace.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClassName()}>
          Go home
        </Link>
        <Link href="/help" className={buttonClassName({ variant: "secondary" })}>
          Help center
        </Link>
        <Link href="/dashboard" className={buttonClassName({ variant: "secondary" })}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
