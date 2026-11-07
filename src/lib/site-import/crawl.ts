import { htmlToText, pageLinks, pageTitle, sitemapEntries } from "@/lib/site-import/html-text";
import {
  DISALLOW_ALL,
  ROBOTS_MAX_BYTES,
  robotsPolicyFor,
  type RobotsPolicy,
} from "@/lib/site-import/robots";
import {
  ImportFetchError,
  fetchPublicPage,
  type PageFetcher,
} from "@/lib/site-import/safe-fetch";

export const IMPORT_LIMITS = {
  maxPages: 25,
  maxBytesPerPage: 2 * 1024 * 1024,
  maxTotalBytes: 10 * 1024 * 1024,
  /** Fetching stops here so saving still fits in the route's 60 seconds. */
  crawlBudgetMs: 30_000,
  maxSitemapUrls: 500,
  maxChildSitemaps: 3,
  maxLinkDepth: 2,
  minPageChars: 200,
  /** Leaves room under the 20,000-character document limit for the source line and title. */
  maxPageChars: 19_000,
} as const;

const SKIPPED_EXTENSIONS =
  /\.(pdf|docx?|xlsx?|pptx?|zip|gz|rar|7z|png|jpe?g|gif|webp|svg|ico|bmp|mp3|mp4|mov|avi|webm|css|js|json|xml|rss|atom|woff2?|ttf|eot|exe|dmg|apk)$/i;

export type CrawledPage = { url: string; title: string; text: string; truncated: boolean };
export type SkippedPage = { url: string; reason: string };
export type CrawlResult = { pages: CrawledPage[]; skipped: SkippedPage[]; stoppedEarly: boolean };

function siteKey(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** Same site, with fragment removed and a stable trailing slash. Null for anything not to crawl. */
export function normaliseCandidate(href: string, base: URL, site: string): URL | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (siteKey(url.hostname) !== site) return null;
  if (SKIPPED_EXTENSIONS.test(url.pathname)) return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url;
}

type CrawlOptions = {
  fetchPage?: PageFetcher;
  now?: () => number;
};

/**
 * Collects readable pages from one website, starting at `start`. Uses the
 * sitemap when there is one, else follows links on the same site up to two
 * clicks deep. Obeys robots.txt for the PenavenBot token and "*".
 */
export async function crawlSite(start: URL, options: CrawlOptions = {}): Promise<CrawlResult> {
  const fetchPage = options.fetchPage ?? fetchPublicPage;
  const now = options.now ?? Date.now;
  const deadline = now() + IMPORT_LIMITS.crawlBudgetMs;
  const site = siteKey(start.hostname);
  const origin = `${start.protocol}//${start.host}`;

  let totalBytes = 0;
  let stoppedEarly = false;
  const skipped: SkippedPage[] = [];
  const pages: CrawledPage[] = [];
  const seenText = new Set<string>();

  const budgetLeft = () => {
    if (now() > deadline || totalBytes >= IMPORT_LIMITS.maxTotalBytes) {
      stoppedEarly = true;
      return false;
    }
    return true;
  };

  const get = async (url: URL, maxBytes = IMPORT_LIMITS.maxBytesPerPage) => {
    const page = await fetchPage(url, Math.min(maxBytes, IMPORT_LIMITS.maxTotalBytes - totalBytes));
    totalBytes += Buffer.byteLength(page.body);
    return page;
  };

  // robots.txt: unreachable means the site said nothing usable, so crawl nothing.
  let robots: RobotsPolicy;
  try {
    const response = await get(new URL("/robots.txt", origin), ROBOTS_MAX_BYTES);
    robots = robotsPolicyFor(response.status, response.body);
  } catch (error) {
    if (error instanceof ImportFetchError && error.code === "blocked") throw error;
    robots = DISALLOW_ALL;
  }

  const allowed = (url: URL) => robots.isAllowed(`${url.pathname}${url.search}`);

  if (!allowed(start)) {
    return {
      pages,
      skipped: [{ url: start.toString(), reason: "The site's robots.txt asks crawlers not to read this page." }],
      stoppedEarly,
    };
  }

  // Candidate list: the start page, then the sitemap's pages.
  const queue: Array<{ url: URL; depth: number }> = [{ url: start, depth: 0 }];
  const queued = new Set([start.toString()]);
  const enqueue = (url: URL | null, depth: number) => {
    if (!url || queued.has(url.toString())) return;
    queued.add(url.toString());
    queue.push({ url, depth });
  };

  const sitemapUrls = robots.sitemaps.length > 0 ? robots.sitemaps : [`${origin}/sitemap.xml`];
  const sitemapQueue = sitemapUrls
    .map((href) => normaliseCandidateSitemap(href, start, site))
    .filter((url): url is URL => url !== null)
    .slice(0, IMPORT_LIMITS.maxChildSitemaps);
  let childSitemaps = 0;
  let fromSitemap = 0;

  while (sitemapQueue.length > 0 && fromSitemap < IMPORT_LIMITS.maxSitemapUrls && budgetLeft()) {
    const sitemapUrl = sitemapQueue.shift()!;
    try {
      const response = await get(sitemapUrl);
      if (response.status < 200 || response.status >= 300) continue;
      const { isIndex, locs } = sitemapEntries(response.body);
      for (const loc of locs) {
        if (isIndex) {
          const child = normaliseCandidateSitemap(loc, start, site);
          if (child && childSitemaps < IMPORT_LIMITS.maxChildSitemaps) {
            childSitemaps++;
            sitemapQueue.push(child);
          }
        } else if (fromSitemap < IMPORT_LIMITS.maxSitemapUrls) {
          const before = queue.length;
          enqueue(normaliseCandidate(loc, start, site), IMPORT_LIMITS.maxLinkDepth);
          if (queue.length > before) fromSitemap++;
        }
      }
    } catch (error) {
      if (error instanceof ImportFetchError && error.code === "blocked") throw error;
      // No usable sitemap: links are followed instead.
    }
  }

  while (queue.length > 0 && pages.length < IMPORT_LIMITS.maxPages && budgetLeft()) {
    const { url, depth } = queue.shift()!;
    if (!allowed(url)) {
      skipped.push({ url: url.toString(), reason: "The site's robots.txt asks crawlers not to read this page." });
      continue;
    }

    let response;
    try {
      response = await get(url);
    } catch (error) {
      if (error instanceof ImportFetchError && error.code === "blocked") throw error;
      skipped.push({
        url: url.toString(),
        reason: error instanceof ImportFetchError ? error.message : "The page could not be read.",
      });
      continue;
    }

    // A redirect to another site is not followed for content.
    const finalUrl = new URL(response.url);
    if (siteKey(finalUrl.hostname) !== site) {
      skipped.push({ url: url.toString(), reason: "The page redirects to a different website." });
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      skipped.push({ url: url.toString(), reason: `The site answered with status ${response.status}.` });
      continue;
    }
    const isHtml = response.contentType.includes("html");
    const isText = response.contentType.startsWith("text/plain");
    if (!isHtml && !isText) {
      skipped.push({ url: url.toString(), reason: "The page is not HTML or text." });
      continue;
    }

    if (isHtml && depth < IMPORT_LIMITS.maxLinkDepth) {
      for (const href of pageLinks(response.body)) {
        enqueue(normaliseCandidate(href, finalUrl, site), depth + 1);
      }
    }

    const fullText = isHtml ? htmlToText(response.body) : response.body.trim();
    if (fullText.length < IMPORT_LIMITS.minPageChars) {
      skipped.push({ url: url.toString(), reason: "The page has too little text to answer from." });
      continue;
    }
    const fingerprint = fullText.slice(0, 2000);
    if (seenText.has(fingerprint)) {
      skipped.push({ url: url.toString(), reason: "Same text as another imported page." });
      continue;
    }
    seenText.add(fingerprint);

    const truncated = fullText.length > IMPORT_LIMITS.maxPageChars;
    pages.push({
      url: finalUrl.toString(),
      title: (isHtml ? pageTitle(response.body) : "") || finalUrl.pathname || finalUrl.hostname,
      text: truncated ? fullText.slice(0, IMPORT_LIMITS.maxPageChars) : fullText,
      truncated,
    });
  }

  if (queue.length > 0 && pages.length >= IMPORT_LIMITS.maxPages) stoppedEarly = true;
  return { pages, skipped, stoppedEarly };
}

function normaliseCandidateSitemap(href: string, base: URL, site: string) {
  try {
    const url = new URL(href, base);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || siteKey(url.hostname) !== site) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
