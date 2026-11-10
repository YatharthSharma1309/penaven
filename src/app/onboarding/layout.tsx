import type { Metadata } from "next";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { privatePageRobots } from "@/lib/seo/robots-meta";

export const metadata: Metadata = {
  robots: privatePageRobots,
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader
        variant="help"
        title="Set up your workspace"
        subtitle="Create or join an organization"
        backHref="/"
        backLabel="Home"
      />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter variant="minimal" />
    </div>
  );
}
