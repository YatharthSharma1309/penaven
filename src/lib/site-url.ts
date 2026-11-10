/** Used when no app URL is configured. */
export const DEFAULT_SITE_URL = "https://penaven.vercel.app";

type SiteUrlEnv = Record<string, string | undefined>;

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/**
 * The public origin of the site, with no trailing slash.
 * APP_URL (already used for embed snippets), then NEXT_PUBLIC_APP_URL,
 * then Vercel's production domain, then the default host.
 */
export function getSiteUrl(env: SiteUrlEnv = process.env): string {
  return (
    normalize(env.APP_URL) ??
    normalize(env.NEXT_PUBLIC_APP_URL) ??
    normalize(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    DEFAULT_SITE_URL
  );
}

/** An absolute URL on the site for a path such as "/help". */
export function absoluteUrl(path: string, siteUrl: string = getSiteUrl()): string {
  if (path === "" || path === "/") return siteUrl;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
