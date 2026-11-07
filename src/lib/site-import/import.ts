import { db } from "@/lib/db";
import { ingestTextDocument } from "@/lib/documents/process";
import { crawlSite, normaliseCandidate, type CrawledPage, type SkippedPage } from "@/lib/site-import/crawl";
import { parsePublicUrl, type PageFetcher } from "@/lib/site-import/safe-fetch";

/** Saving stops here, so the route answers inside its 60 seconds. */
const SAVE_DEADLINE_MS = 52_000;

export type ImportSummary = {
  site: string;
  imported: Array<{ title: string; url: string; documentId: string; truncated: boolean }>;
  skipped: SkippedPage[];
  stoppedEarly: boolean;
};

/** One file name per page, so importing the site again replaces pages instead of duplicating them. */
export function importedFileName(pageUrl: string) {
  const url = new URL(pageUrl);
  const key = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  return `web_${key.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+$/, "").slice(0, 150)}.md`;
}

export function importedContent(page: CrawledPage) {
  const note = page.truncated ? "\n\n(Only the first part of this page was imported.)" : "";
  return `Source: ${page.url}\n\n# ${page.title}\n\n${page.text}${note}`;
}

export async function importWebsite(
  organizationId: string,
  address: string,
  options: { fetchPage?: PageFetcher; now?: () => number } = {},
): Promise<ImportSummary> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const parsed = parsePublicUrl(address);
  const start = normaliseCandidate(parsed.toString(), parsed, parsed.hostname.replace(/^www\./, "").toLowerCase()) ?? parsed;

  const crawl = await crawlSite(start, options);
  const imported: ImportSummary["imported"] = [];
  const skipped = [...crawl.skipped];
  let stoppedEarly = crawl.stoppedEarly;

  for (const page of crawl.pages) {
    if (now() - startedAt > SAVE_DEADLINE_MS) {
      stoppedEarly = true;
      skipped.push({ url: page.url, reason: "Time ran out before this page was saved. Import again to add it." });
      continue;
    }

    const fileName = importedFileName(page.url);
    try {
      const document = await ingestTextDocument(organizationId, {
        title: page.title,
        content: importedContent(page),
        fileName,
      });
      // Replace the earlier import of this page only once the new one is saved.
      await db.document.deleteMany({
        where: { organizationId, fileName, id: { not: document.id } },
      });
      imported.push({ title: document.title, url: page.url, documentId: document.id, truncated: page.truncated });
    } catch (error) {
      console.error("Website import could not save a page", error);
      skipped.push({ url: page.url, reason: "The page was read but could not be saved." });
    }
  }

  return { site: start.hostname, imported, skipped, stoppedEarly };
}
