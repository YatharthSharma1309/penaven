import type { MetadataRoute } from "next";
import {
  PRIVATE_PATH_PREFIXES,
  PUBLIC_PATH_PREFIXES,
} from "@/lib/seo/robots-meta";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: [...PUBLIC_PATH_PREFIXES],
      disallow: [...PRIVATE_PATH_PREFIXES],
    },
    sitemap: absoluteUrl("/sitemap.xml", siteUrl),
    host: siteUrl,
  };
}
