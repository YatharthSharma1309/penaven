import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DemoHiringProvider } from "@/components/recruitment/demo-hiring-provider";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import { privatePageRobots } from "@/lib/seo/robots-meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: privatePageRobots,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organization, role } = await requireOrgMembershipOrRedirect();

  const shell = (
    <DashboardShell organizationSlug={organization.slug} role={role}>
      {children}
    </DashboardShell>
  );

  if (!isPublicDemoMode()) return shell;

  return <DemoHiringProvider>{shell}</DemoHiringProvider>;
}
