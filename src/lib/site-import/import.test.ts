import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageFetcher } from "@/lib/site-import/safe-fetch";

const store = vi.hoisted(() => ({
  documents: [] as Array<{ id: string; organizationId: string; fileName: string; title: string }>,
  seq: 0,
  failTitle: null as string | null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      deleteMany: vi.fn(
        async ({ where }: { where: { organizationId: string; fileName: string; id: { not: string } } }) => {
          const before = store.documents.length;
          store.documents = store.documents.filter(
            (doc) =>
              !(doc.organizationId === where.organizationId && doc.fileName === where.fileName && doc.id !== where.id.not),
          );
          return { count: before - store.documents.length };
        },
      ),
    },
  },
}));

vi.mock("@/lib/documents/process", () => ({
  ingestTextDocument: vi.fn(
    async (organizationId: string, input: { title: string; content: string; fileName: string }) => {
      if (input.title === store.failTitle) throw new Error("db down");
      const doc = { id: `doc_${++store.seq}`, organizationId, fileName: input.fileName, title: input.title };
      store.documents.push(doc);
      return doc;
    },
  ),
}));

const { importWebsite, importedFileName } = await import("@/lib/site-import/import");

const TEXT =
  "Orders ship within two working days. Tracking arrives by email once the parcel leaves the warehouse, and most orders reach metro cities in three to five days. Remote pin codes can take up to a week.";

function html(title: string, links: string[] = []) {
  return `<html><head><title>${title}</title></head><body><main><p>${TEXT} ${title}.</p>${links
    .map((l) => `<a href="${l}">x</a>`)
    .join("")}</main></body></html>`;
}

const fetchPage: PageFetcher = async (url) => {
  const routes: Record<string, string> = {
    "/": html("Home", ["/shipping", "/broken"]),
    "/shipping": html("Shipping"),
    "/broken": html("Broken"),
  };
  const body = routes[url.pathname];
  return body
    ? { url: url.toString(), status: 200, contentType: "text/html", body }
    : { url: url.toString(), status: 404, contentType: "text/plain", body: "" };
};

beforeEach(() => {
  store.documents = [];
  store.seq = 0;
  store.failTitle = null;
});

describe("importWebsite", () => {
  it("saves each page with its source, and importing again replaces rather than duplicates", async () => {
    const first = await importWebsite("org_1", "shop.example", { fetchPage });
    expect(first.imported.map((p) => p.title)).toEqual(["Home", "Shipping", "Broken"]);
    expect(store.documents).toHaveLength(3);

    await importWebsite("org_1", "https://shop.example/", { fetchPage });
    expect(store.documents).toHaveLength(3);
    expect(store.documents.map((d) => d.id)).toEqual(["doc_4", "doc_5", "doc_6"]);
  });

  it("keeps the old copy of a page whose new import fails, and reports it", async () => {
    await importWebsite("org_1", "shop.example", { fetchPage });
    store.failTitle = "Broken";
    const second = await importWebsite("org_1", "shop.example", { fetchPage });

    expect(second.skipped.some((s) => s.url.endsWith("/broken"))).toBe(true);
    expect(store.documents.filter((d) => d.title === "Broken")).toHaveLength(1);
  });

  it("never touches another workspace's documents", async () => {
    await importWebsite("org_2", "shop.example", { fetchPage });
    await importWebsite("org_1", "shop.example", { fetchPage });
    expect(store.documents.filter((d) => d.organizationId === "org_2")).toHaveLength(3);
  });

  it("names files by site and path", () => {
    expect(importedFileName("https://www.shop.example/")).toBe("web_shop.example.md");
    expect(importedFileName("https://shop.example/help/returns?lang=en")).toBe(
      "web_shop.example_help_returns_lang_en.md",
    );
  });
});
