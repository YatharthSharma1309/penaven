import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { DemoHiringProvider } from "@/components/recruitment/demo-hiring-provider";

export const metadata = {
  title: "Sample hiring demo | Penaven",
  description:
    "Review a fictional job, compare sample candidates, and shortlist. Resumes are not real. Choices stay in this browser.",
};

export default function DemoHiringLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoHiringProvider>
      <div className="min-h-full bg-background">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <BrandLogo href="/" size="sm" />
            <p className="text-sm text-muted">Fictional sample · this browser</p>
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Back to home
            </Link>
          </div>
        </header>
        {children}
      </div>
    </DemoHiringProvider>
  );
}
