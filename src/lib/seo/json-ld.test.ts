import { describe, expect, it } from "vitest";
import { buildHomeJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

type Node = Record<string, unknown>;

function graph(siteUrl = "https://app.example.com") {
  return buildHomeJsonLd(siteUrl)["@graph"] as Node[];
}

describe("buildHomeJsonLd", () => {
  it("describes Penaven as a SoftwareApplication with the published prices", () => {
    const app = graph().find((node) => node["@type"] === "SoftwareApplication");
    expect(app).toBeDefined();
    expect(app?.name).toBe("Penaven");
    expect(app?.applicationCategory).toBe("BusinessApplication");

    const offers = app?.offers as Node[];
    expect(offers.map((offer) => [offer.name, offer.price, offer.priceCurrency])).toEqual([
      ["Free", "0", "USD"],
      ["Pro", "39", "USD"],
    ]);
    const proSpec = offers[1].priceSpecification as Node;
    expect(proSpec.price).toBe("39");
    expect(proSpec.unitCode).toBe("MON");
  });

  it("includes the Organization at the site URL", () => {
    const org = graph().find((node) => node["@type"] === "Organization");
    expect(org?.name).toBe("Penaven");
    expect(org?.url).toBe("https://app.example.com");
    expect(buildHomeJsonLd("https://app.example.com")["@context"]).toBe(
      "https://schema.org",
    );
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so the data cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
