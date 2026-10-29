import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function loadHelpOrganizations() {
  try {
    return await db.organization.findMany({
      where: {
        widgetEnabled: true,
        documents: { some: { status: "READY" } },
      },
      select: {
        name: true,
        slug: true,
        _count: { select: { documents: { where: { status: "READY" } } } },
      },
      orderBy: { name: "asc" },
      take: 50,
    });
  } catch (error) {
    console.error("Help centers could not be loaded", error);
    return null;
  }
}

export default async function HelpIndexPage() {
  const organizations = await loadHelpOrganizations();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader
        variant="help"
        title="Help Centers"
        subtitle="Browse public knowledge bases by organization"
        backHref="/"
        backLabel="Home"
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6"
      >
        {organizations === null ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Help centers are unavailable right now. Published articles will
              show here once the workspace is reachable again.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Back to home
            </Link>
          </div>
        ) : organizations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-4 text-sm text-slate-600">
              No public help centers are available yet. Organizations appear here
              once they publish ready knowledge base articles.
            </p>
            <Link
              href="/sign-up"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Create your workspace →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {organizations.map((org) => (
              <li key={org.slug}>
                <Link
                  href={`/help/${org.slug}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div>
                    <p className="font-medium text-slate-900">{org.name}</p>
                    <p className="text-sm text-slate-500">
                      {org._count.documents} published article
                      {org._count.documents === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter variant="minimal" />
    </div>
  );
}
