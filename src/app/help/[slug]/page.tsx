import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HelpCenterExperience } from "@/components/help/help-center-experience";
import { db } from "@/lib/db";
import { getAgentSettings } from "@/lib/settings";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type HelpSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function HelpSlugPage({ params }: HelpSlugPageProps) {
  const { slug } = await params;

  const organization = await db.organization.findUnique({
    where: { slug },
  });

  if (!organization || !organization.widgetEnabled) {
    notFound();
  }

  const [documents, settings] = await Promise.all([
    db.document.findMany({
      where: { organizationId: organization.id, status: "READY" },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
          select: { id: true, content: true, chunkIndex: true },
        },
      },
      orderBy: { title: "asc" },
    }),
    getAgentSettings(organization.id),
  ]);

  const articles = documents.map((document) => ({
    id: document.id,
    title: document.title,
    chunks: document.chunks,
  }));

  const hasDocuments = articles.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader
        variant="help"
        title={`${organization.name} Help Center`}
        subtitle="Search answers from the knowledge base"
        backHref="/help"
        backLabel="All help centers"
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
      >
        {!hasDocuments ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">
              Help center is being prepared
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {organization.name} has not published any articles yet. Check back
              soon or contact their support team.
            </p>
          </div>
        ) : null}

        <HelpCenterExperience
          articles={articles}
          widgetKey={organization.widgetPublicKey}
          hasDocuments={hasDocuments}
          welcomeMessage={settings.greeting}
          organizationName={organization.name}
        />
      </main>

      <SiteFooter variant="minimal" />
    </div>
  );
}
