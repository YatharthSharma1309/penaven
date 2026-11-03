import { describe, expect, it } from "vitest";
import { rankChunksByKeywords } from "./retrieve";

const faq = {
  id: "chunk-1",
  documentId: "doc-1",
  documentTitle: "support-faq",
  content:
    "Customers can request a full refund within 14 days of purchase. After 14 days, refunds are reviewed case by case. We accept Visa and PayPal.",
};

describe("rankChunksByKeywords", () => {
  it("keeps a chunk when the question uses words from the document", () => {
    const ranked = rankChunksByKeywords("What is the refund policy?", [faq]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.documentTitle).toBe("support-faq");
  });

  it("drops the only chunk when the overlap is just common words", () => {
    const ranked = rankChunksByKeywords(
      "What is your Austin office street address?",
      [faq],
    );
    expect(ranked).toHaveLength(0);
  });
});

const clinic = {
  id: "clinic-chunk",
  documentId: "clinic-doc",
  documentTitle: "Brightside Dental FAQ",
  content: `# Brightside Dental (sample clinic) - Patient FAQ
## Opening hours
We are open Monday to Friday, 8:00 am to 6:00 pm, and Saturday 9:00 am to 1:00 pm. We are closed on Sundays.
## Cancellations and refunds
Please cancel or move an appointment at least 24 hours ahead. Appointments cancelled with less than 24 hours notice are charged a $25 late cancellation fee. Deposits for whitening are refunded in full if you cancel 48 hours ahead.
## Insurance
We accept Delta Dental, Cigna and Aetna PPO plans. Bring your insurance card to your first visit.`,
};

const shop = {
  id: "shop-chunk",
  documentId: "shop-doc",
  documentTitle: "Northpeak Outdoor FAQ",
  content: `# Northpeak Outdoor (sample gear shop) - Customer FAQ
## Opening hours
Our online store is open all the time. Customer support answers from 10:00 am to 7:00 pm, every day including weekends.
## Returns and refunds
You can return unused gear within 60 days for a full refund. Refunds go back to the original card within 5 business days of the return arriving. Worn footwear can be returned within 14 days.
## Shipping
Orders over $75 ship free. Standard shipping takes 3 to 5 business days.`,
};

describe("rankChunksByKeywords word forms", () => {
  it.each([
    "What is your refund policy?",
    "Can I get a refund?",
    "What are your refunds like?",
    "Do you refund cancellations?",
  ])("finds the clinic FAQ for %j", (question) => {
    const ranked = rankChunksByKeywords(question, [clinic]);
    expect(ranked.map((chunk) => chunk.documentId)).toEqual(["clinic-doc"]);
  });

  it.each([
    "What is your refund policy?",
    "Can I get a refund?",
    "What are your refunds like?",
  ])("finds the shop FAQ for %j", (question) => {
    const ranked = rankChunksByKeywords(question, [shop]);
    expect(ranked.map((chunk) => chunk.documentId)).toEqual(["shop-doc"]);
  });

  it("matches other inflections both ways", () => {
    expect(rankChunksByKeywords("Is shipping free?", [shop])).toHaveLength(1);
    expect(rankChunksByKeywords("Is there a cancellation charge?", [clinic])).toHaveLength(1);
    expect(rankChunksByKeywords("How do returns work?", [shop])).toHaveLength(1);
  });

  it("still misses an unrelated question", () => {
    expect(rankChunksByKeywords("Do you sell gift cards?", [clinic, shop])).toHaveLength(0);
    expect(rankChunksByKeywords("Do you offer parking?", [clinic, shop])).toHaveLength(0);
  });

  it("only ranks the chunks it is given", () => {
    expect(
      rankChunksByKeywords("Are whitening deposits refunded?", [shop]),
    ).toHaveLength(0);

    const ranked = rankChunksByKeywords("Are whitening deposits refunded?", [
      shop,
      clinic,
    ]);
    expect(ranked.map((chunk) => chunk.documentId)).toEqual(["clinic-doc"]);
  });
});
