import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { PUBLIC_DEMO_HIRING_PATH } from "@/lib/recruitment/demo-sample";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

/** Rebuilt at most once an hour, so new public help centres show up without a deploy. */
export const revalidate = 3600;

/**
 * True while `next build` prerenders the sitemap, or when no database is
 * configured. A build must never fail for want of a database.
 */
function isBuildWithoutDatabase() {
  return (
    process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL?.trim()
  );
}

/**
 * Same rule as the /help index: the help centre is on (widgetEnabled)
 * and has at least one ready article.
 *
 * On a database error at build time this returns [], so the build still ships
 * the static pages. At revalidation time it rethrows: Next.js then keeps
 * serving the last good sitemap and retries on the next request, instead of
 * caching a sitemap without help centres for a whole revalidate window.
 */
async function loadPublicHelpCentres() {
  try {
    return await db.organization.findMany({
      where: {
        widgetEnabled: true,
        documents: { some: { status: "READY" } },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: "asc" },
      take: 5000,
    });
  } catch (error) {
    console.error("Sitemap help centres could not be loaded", error);
    if (isBuildWithoutDatabase()) return [];
    throw error;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/", siteUrl), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/help", siteUrl), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/contact", siteUrl), changeFrequency: "monthly", priority: 0.5 },
    {
      url: absoluteUrl(PUBLIC_DEMO_HIRING_PATH, siteUrl),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const helpCentres = await loadPublicHelpCentres();
  const helpEntries: MetadataRoute.Sitemap = helpCentres.map((organization) => ({
    url: absoluteUrl(`/help/${encodeURIComponent(organization.slug)}`, siteUrl),
    lastModified: organization.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...helpEntries];
}
