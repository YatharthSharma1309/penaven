import { db } from "@/lib/db";

/** A document still reading after this long was cut off mid-way. */
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export const STALE_PROCESSING_MESSAGE = "Reading took too long. Upload it again.";

/**
 * Marks documents stuck in PROCESSING as FAILED. If the function reading a
 * file is stopped part way, nothing else would ever finish the row.
 * A failure here must not break the list, so it is logged and skipped.
 */
export async function failStaleProcessingDocuments(
  organizationId: string,
  now: Date = new Date(),
) {
  try {
    const result = await db.document.updateMany({
      where: {
        organizationId,
        status: "PROCESSING",
        updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) },
      },
      data: { status: "FAILED", errorMessage: STALE_PROCESSING_MESSAGE },
    });
    return result.count;
  } catch (error) {
    console.error(
      "Could not mark stale documents as failed:",
      error instanceof Error ? error.message : error,
    );
    return 0;
  }
}
