import { describe, expect, it } from "vitest";
import { crawlSite, IMPORT_LIMITS, normaliseCandidate } from "@/lib/site-import/crawl";
import { htmlToText, pageLinks, pageTitle, sitemapEntries } from "@/lib/site-import/html-text";
import { parseRobots, robotsPolicyFor } from "@/lib/site-import/robots";
import {
  ImportFetchError,
  isBlockedAddress,
  parsePublicUrl,
  type FetchedPage,
  type PageFetcher,
} from "@/lib/site-import/safe-fetch";

const FILLER =
  "Returns are free within 30 days of delivery. Pack the item in its original box, print the label from your order page, and drop it at any courier point. Refunds reach your card within 5 to 7 working days after we receive the parcel.";

function page(title: string, body: string, links: string[] = []) {
  return `<!doctype html><html><head><title>${title}</title><script>var x = "<p>hidden</p>";</script></head>
  <body><nav><a href="/">Home</a> Menu text that should go</nav>
  <main><h1>${title}</h1><p>${body}</p>${links.map((href) => `<a href="${href}">link</a>`).join(" ")}</main>
  <footer>© Shop footer</footer></body></html>`;
}

/** A fake website: path -> response. Anything missing is a 404. */
function fakeSite(routes: Record<string, Partial<FetchedPage> & { body: string }>) {
  const requested: string[] = [];
  const fetchPage: PageFetcher = async (url) => {
    requested.push(url.pathname + url.search);
    const route = routes[url.pathname + url.search] ?? routes[url.pathname];
    if (!route) return { url: url.toString(), status: 404, contentType: "text/html", body: "Not found" };
    return {
      url: route.url ?? url.toString(),
      status: route.status ?? 200,
      contentType: route.contentType ?? "text/html; charset=utf-8",
      body: route.body,
    };
  };
  return { fetchPage, requested };
}

describe("isBlockedAddress", () => {
  it("refuses loopback, private, link-local, metadata and mapped forms", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.5",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "not-an-ip",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });
});

describe("parsePublicUrl", () => {
  it("adds https:// and keeps the path", () => {
    expect(parsePublicUrl("example.com/faq").toString()).toBe("https://example.com/faq");
  });

  it("refuses private, local, odd-port, credentialed and non-web addresses", () => {
    for (const input of [
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost:3000",
      "https://intranet",
      "https://printer.local",
      "https://example.com:8443/",
      "https://user:pass@example.com/",
      "ftp://example.com/",
      "file:///etc/passwd",
      "",
      "https://exa mple.com",
    ]) {
      expect(() => parsePublicUrl(input), input).toThrow(ImportFetchError);
    }
  });
});

describe("robots.txt", () => {
  const robots = parseRobots(`
    # comment
    User-agent: *
    Disallow: /account
    Disallow: /*.pdf$
    Allow: /account/help

    User-agent: OtherBot
    Disallow: /

    Sitemap: https://shop.example/sitemap.xml
  `);

  it("uses the * group when ours is not named, with the longest rule winning", () => {
    expect(robots.isAllowed("/faq")).toBe(true);
    expect(robots.isAllowed("/account/orders")).toBe(false);
    expect(robots.isAllowed("/account/help/returns")).toBe(true);
    expect(robots.isAllowed("/guide.pdf")).toBe(false);
    expect(robots.isAllowed("/guide.pdf?x=1")).toBe(true);
    expect(robots.sitemaps).toEqual(["https://shop.example/sitemap.xml"]);
  });

  it("prefers a group naming PenavenBot, matched without case", () => {
    const named = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: PenavenBot\nDisallow: /private");
    expect(named.isAllowed("/faq")).toBe(true);
    expect(named.isAllowed("/private/x")).toBe(false);
  });

  it("lets allow win a tie, and treats an empty disallow as allow-all", () => {
    expect(parseRobots("User-agent: *\nDisallow: /faq\nAllow: /faq").isAllowed("/faq")).toBe(true);
    expect(parseRobots("User-agent: *\nDisallow:").isAllowed("/anything")).toBe(true);
  });

  it("allows all on 4xx, refuses all on 5xx, and always allows /robots.txt", () => {
    expect(robotsPolicyFor(404, "").isAllowed("/x")).toBe(true);
    expect(robotsPolicyFor(503, "").isAllowed("/x")).toBe(false);
    expect(robotsPolicyFor(503, "").isAllowed("/robots.txt")).toBe(true);
    expect(parseRobots("User-agent: *\nDisallow: /").isAllowed("/robots.txt")).toBe(true);
  });
});

describe("HTML to text", () => {
  const html = page("Returns &amp; refunds", `${FILLER} Call us &#8211; we&rsquo;re here.`, ["/shipping"]);

  it("keeps the page's words and drops scripts, menus and footers", () => {
    const text = htmlToText(html);
    expect(text).toContain("# Returns & refunds");
    expect(text).toContain("Returns are free within 30 days");
    expect(text).toContain("Call us – we’re here.");
    expect(text).not.toContain("hidden");
    expect(text).not.toContain("Menu text");
    expect(text).not.toContain("Shop footer");
  });

  it("reads the title, links and sitemap entries", () => {
    expect(pageTitle(html)).toBe("Returns & refunds");
    expect(pageLinks(html)).toContain("/shipping");
    expect(
      sitemapEntries("<urlset><url><loc>https://a.example/x?a=1&amp;b=2</loc></url></urlset>"),
    ).toEqual({ isIndex: false, locs: ["https://a.example/x?a=1&b=2"] });
    expect(sitemapEntries("<sitemapindex><sitemap><loc>https://a.example/s1.xml</loc></sitemap></sitemapindex>").isIndex).toBe(true);
  });

  it("ignores invalid numeric entities instead of throwing", () => {
    expect(htmlToText("<p>a&#0;b&#xD800;c&#99999999;d</p>")).toBe("abcd");
  });
});

describe("normaliseCandidate", () => {
  const base = new URL("https://www.shop.example/faq");
  it("keeps same-site pages, drops fragments, files and other sites", () => {
    expect(normaliseCandidate("/shipping/#top", base, "shop.example")?.toString()).toBe(
      "https://www.shop.example/shipping",
    );
    expect(normaliseCandidate("https://shop.example/a", base, "shop.example")).not.toBeNull();
    expect(normaliseCandidate("https://other.example/a", base, "shop.example")).toBeNull();
    expect(normaliseCandidate("/brochure.pdf", base, "shop.example")).toBeNull();
    expect(normaliseCandidate("mailto:hi@shop.example", base, "shop.example")).toBeNull();
    expect(normaliseCandidate("javascript:alert(1)", base, "shop.example")).toBeNull();
  });
});

describe("crawlSite", () => {
  const start = new URL("https://shop.example/");

  it("follows links on the same site and skips what robots.txt blocks", async () => {
    const site = fakeSite({
      "/robots.txt": { body: "User-agent: *\nDisallow: /account", contentType: "text/plain" },
      "/": { body: page("Home", FILLER, ["/returns", "/account/orders", "https://other.example/x"]) },
      "/returns": { body: page("Returns", `${FILLER} Exchanges are free too.`) },
      "/account/orders": { body: page("Orders", FILLER) },
    });

    const result = await crawlSite(start, { fetchPage: site.fetchPage });

    expect(result.pages.map((p) => p.title)).toEqual(["Home", "Returns"]);
    expect(site.requested).not.toContain("/account/orders");
    expect(result.skipped.some((s) => s.url.endsWith("/account/orders"))).toBe(true);
  });

  it("reads pages from the sitemap", async () => {
    const site = fakeSite({
      "/robots.txt": { body: "", status: 404 },
      "/sitemap.xml": {
        body: "<urlset><url><loc>https://shop.example/faq</loc></url><url><loc>https://elsewhere.example/x</loc></url></urlset>",
        contentType: "application/xml",
      },
      "/": { body: page("Home", FILLER) },
      "/faq": { body: page("FAQ", `${FILLER} Shipping takes 3 days.`) },
    });

    const result = await crawlSite(start, { fetchPage: site.fetchPage });
    expect(result.pages.map((p) => p.title)).toEqual(["Home", "FAQ"]);
    expect(site.requested).not.toContain("/x");
  });

  it("reads nothing when robots.txt cannot be fetched", async () => {
    const site = fakeSite({
      "/robots.txt": { body: "down", status: 503 },
      "/": { body: page("Home", FILLER) },
    });
    const result = await crawlSite(start, { fetchPage: site.fetchPage });
    expect(result.pages).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/robots\.txt/);
  });

  it("skips thin pages, duplicates, non-HTML and off-site redirects", async () => {
    const home = page("Home", FILLER, ["/thin", "/copy", "/data", "/moved"]);
    const site = fakeSite({
      "/robots.txt": { body: "", status: 404 },
      "/": { body: home },
      "/thin": { body: page("Thin", "Short.") },
      "/copy": { body: home },
      "/data": { body: "{}", contentType: "application/json" },
      "/moved": { body: page("Moved", FILLER), url: "https://other.example/landing" },
    });
    const result = await crawlSite(start, { fetchPage: site.fetchPage });
    expect(result.pages.map((p) => p.title)).toEqual(["Home"]);
    const reasons = result.skipped.map((s) => s.reason).join(" | ");
    expect(reasons).toMatch(/too little text/);
    expect(reasons).toMatch(/Same text/);
    expect(reasons).toMatch(/not HTML/);
    expect(reasons).toMatch(/different website/);
  });

  it("stops at the page limit and says so", async () => {
    const links = Array.from({ length: 40 }, (_, i) => `/p${i}`);
    const routes: Record<string, { body: string; status?: number }> = {
      "/robots.txt": { body: "", status: 404 },
      "/": { body: page("Home", FILLER, links) },
    };
    for (const link of links) routes[link] = { body: page(link, `${FILLER} ${link} unique words ${link}.`) };
    const result = await crawlSite(start, { fetchPage: fakeSite(routes).fetchPage });
    expect(result.pages).toHaveLength(IMPORT_LIMITS.maxPages);
    expect(result.stoppedEarly).toBe(true);
  });

  it("stops when the time budget runs out", async () => {
    let clock = 0;
    const site = fakeSite({
      "/robots.txt": { body: "", status: 404 },
      "/": { body: page("Home", FILLER, ["/a"]) },
      "/a": { body: page("A", `${FILLER} more`) },
    });
    const slow: PageFetcher = async (url, max) => {
      clock += IMPORT_LIMITS.crawlBudgetMs;
      return site.fetchPage(url, max);
    };
    const result = await crawlSite(start, { fetchPage: slow, now: () => clock });
    expect(result.stoppedEarly).toBe(true);
    expect(result.pages.length).toBeLessThan(2);
  });

  it("passes a blocked-address refusal straight up", async () => {
    const blocked: PageFetcher = async () => {
      throw new ImportFetchError("private", "blocked");
    };
    await expect(crawlSite(start, { fetchPage: blocked })).rejects.toThrow(ImportFetchError);
  });
});
