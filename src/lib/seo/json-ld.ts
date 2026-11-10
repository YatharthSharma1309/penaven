import { PLANS } from "@/lib/billing/plans";
import { companyDescription, companyName } from "@/lib/brand";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

type JsonLd = Record<string, unknown>;

/** SoftwareApplication and Organization for the home page, priced from PLANS. */
export function buildHomeJsonLd(siteUrl: string = getSiteUrl()): JsonLd {
  const organizationId = `${siteUrl}/#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: companyName,
        url: siteUrl,
        logo: absoluteUrl("/icon.svg", siteUrl),
        description: companyDescription,
      },
      {
        "@type": "SoftwareApplication",
        name: companyName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteUrl,
        description: companyDescription,
        publisher: { "@id": organizationId },
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: String(PLANS.free.priceUsd),
            priceCurrency: "USD",
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: String(PLANS.pro.priceUsd),
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: String(PLANS.pro.priceUsd),
              priceCurrency: "USD",
              unitCode: "MON",
              referenceQuantity: {
                "@type": "QuantitativeValue",
                value: 1,
                unitCode: "MON",
              },
            },
          },
        ],
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
