import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: { document: { updateMany } } }));

import {
  failStaleProcessingDocuments,
  STALE_PROCESSING_MESSAGE,
} from "@/lib/documents/stale";

beforeEach(() => {
  updateMany.mockReset();
});

describe("failStaleProcessingDocuments", () => {
  it("fails only this workspace's documents stuck in PROCESSING over 5 minutes", async () => {
    updateMany.mockResolvedValueOnce({ count: 2 });
    const now = new Date("2026-11-10T12:00:00Z");

    expect(await failStaleProcessingDocuments("org_1", now)).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_1",
        status: "PROCESSING",
        updatedAt: { lt: new Date("2026-11-10T11:55:00Z") },
      },
      data: { status: "FAILED", errorMessage: "Reading took too long. Upload it again." },
    });
    expect(STALE_PROCESSING_MESSAGE).toBe("Reading took too long. Upload it again.");
  });

  it("does not break the list when the write is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    updateMany.mockRejectedValueOnce(new Error("read-only"));
    expect(await failStaleProcessingDocuments("org_1")).toBe(0);
  });
});
