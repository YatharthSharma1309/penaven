/**
 * robots.txt as RFC 9309 describes it: the group naming our product token
 * (case-insensitive, all such groups merged), else the "*" group, else no
 * rules. The longest matching rule wins, and allow wins a tie.
 */

export const ROBOTS_PRODUCT_TOKEN = "penavenbot";

/** RFC 9309 asks for at least 500 KiB to be parsed. */
export const ROBOTS_MAX_BYTES = 512 * 1024;

type Rule = { allow: boolean; pattern: string };

export type RobotsPolicy = {
  isAllowed(pathAndQuery: string): boolean;
  sitemaps: string[];
};

export const ALLOW_ALL: RobotsPolicy = { isAllowed: () => true, sitemaps: [] };
export const DISALLOW_ALL: RobotsPolicy = {
  isAllowed: (path) => path === "/robots.txt",
  sitemaps: [],
};

/** Percent-decodes unreserved characters and encodes non-ASCII, so equal paths compare equal. */
function normalisePath(path: string) {
  const decoded = path.replace(/%([0-9a-f]{2})/gi, (match, hex: string) => {
    const char = String.fromCharCode(parseInt(hex, 16));
    return /[A-Za-z0-9\-._~]/.test(char) ? char : match.toUpperCase();
  });
  return decoded.replace(/[^\x21-\x7e]/g, (char) => encodeURIComponent(char));
}

function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${source}${anchored ? "$" : ""}`);
  return regex.test(path) ? body.length : -1;
}

export function parseRobots(text: string, token = ROBOTS_PRODUCT_TOKEN): RobotsPolicy {
  const ours: Rule[] = [];
  const star: Rule[] = [];
  const sitemaps: string[] = [];
  let sawOurs = false;
  let sawStar = false;

  let agents: string[] = [];
  let inRules = false;

  for (const rawLine of text.slice(0, ROBOTS_MAX_BYTES).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (inRules) {
        agents = [];
        inRules = false;
      }
      agents.push(value.toLowerCase());
      if (value.toLowerCase() === token) sawOurs = true;
      if (value === "*") sawStar = true;
    } else if (key === "allow" || key === "disallow") {
      inRules = true;
      if (agents.length === 0) continue; // Rules before any user-agent are ignored.
      if (key === "disallow" && value === "") continue; // An empty disallow allows everything.
      const rule = { allow: key === "allow", pattern: normalisePath(value) };
      if (agents.includes(token)) ours.push(rule);
      if (agents.includes("*")) star.push(rule);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }

  const rules = sawOurs ? ours : sawStar ? star : [];

  return {
    sitemaps,
    isAllowed(pathAndQuery: string) {
      if (pathAndQuery === "/robots.txt") return true;
      const path = normalisePath(pathAndQuery || "/");
      let best: Rule | null = null;
      let bestLength = -1;
      for (const rule of rules) {
        const length = matchLength(rule.pattern, path);
        if (length > bestLength || (length === bestLength && length >= 0 && rule.allow)) {
          best = rule;
          bestLength = length;
        }
      }
      return best ? best.allow : true;
    },
  };
}

/** What a robots.txt response means: 2xx parse it, 4xx allow all, anything else disallow all. */
export function robotsPolicyFor(status: number, body: string): RobotsPolicy {
  if (status >= 200 && status < 300) return parseRobots(body);
  if (status >= 400 && status < 500) return ALLOW_ALL;
  return DISALLOW_ALL;
}
