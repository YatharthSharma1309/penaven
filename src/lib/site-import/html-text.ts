/**
 * Turns a page's HTML into the plain text customers would read, without a
 * DOM library. Menus, headers, footers, scripts and forms are dropped, since
 * answering from a navigation bar only adds noise.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  rupee: "₹",
  middot: "·",
  bull: "•",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        return "";
      }
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function removeElements(html: string, tags: string[]) {
  let out = html;
  for (const tag of tags) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), " ");
  }
  return out;
}

export function pageTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1];
  const raw = title ?? h1 ?? "";
  return decodeEntities(raw.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function htmlToText(html: string) {
  let body = html.replace(/<!--[\s\S]*?-->/g, " ");
  body = removeElements(body, [
    "head",
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "iframe",
    "canvas",
    "form",
    "nav",
    "header",
    "footer",
    "aside",
  ]);

  // Prefer the page's main content when it marks one.
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1];
  if (main && main.replace(/<[^>]+>/g, "").trim().length > 200) body = main;

  const text = body
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, level: string) => `\n\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|tr|li|ul|ol|table|blockquote|dd|dt|pre)\s*>/gi, "\n")
    .replace(/<\/(td|th)\s*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .replace(/ /g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .filter((line, index, lines) => line !== "- " && !(line === "" && lines[index - 1] === ""))
    .join("\n")
    .trim();
}

/** The href of every <a>, as written. */
export function pageLinks(html: string) {
  const links: string[] = [];
  const pattern = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  for (const match of html.matchAll(pattern)) {
    const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (href) links.push(href);
  }
  return links;
}

/** <loc> entries of a sitemap, and whether it is a sitemap index. */
export function sitemapEntries(xml: string) {
  const isIndex = /<sitemapindex\b/i.test(xml);
  const locs = [...xml.matchAll(/<loc\b[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc\s*>/gi)].map(
    (match) => decodeEntities(match[1].trim()),
  );
  return { isIndex, locs };
}
