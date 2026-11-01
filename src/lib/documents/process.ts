import path from "path";
import { db } from "@/lib/db";
import { MAX_FAQ_CONTENT_CHARS } from "@/lib/documents/constants";
import { stripPdfPageMarkers } from "@/lib/documents/pdf-text";
import { chunkText, estimateTokenCount } from "@/lib/rag/chunk";
import { createEmbeddings } from "@/lib/rag/embed";

const CHUNK_INSERT_TIMEOUT_MS = 30_000;

const UNREADABLE_FILE =
  "This file could not be read. It may be damaged or password protected. Export it again and retry.";

/** A problem with what was sent. The message is safe to show to the sender. */
export class DocumentInputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DocumentInputError";
    this.status = status;
  }
}

/** Only input errors are stored and shown. Others can hold database text. */
function failureMessage(error: unknown) {
  return error instanceof DocumentInputError
    ? error.message
    : "Failed to process document";
}

/**
 * Saves all chunks in one bulk insert. One insert per chunk ran past the
 * default 5 second transaction limit on large files, within the 10 MB cap.
 */
async function storeChunks(
  documentId: string,
  chunks: string[],
  embeddings: (number[] | null)[],
) {
  await db.$transaction(
    (tx) =>
      tx.documentChunk.createMany({
        data: chunks.map((content, index) => ({
          documentId,
          content,
          chunkIndex: index,
          tokenCount: estimateTokenCount(content),
          embedding: embeddings[index] ?? undefined,
        })),
      }),
    { timeout: CHUNK_INSERT_TIMEOUT_MS },
  );
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType: string,
): Promise<string> {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".txt" || extension === ".md" || fileType.includes("text")) {
    return buffer.toString("utf-8");
  }

  if (extension === ".pdf" || fileType.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return stripPdfPageMarkers(result.text);
    } catch (error) {
      console.error("PDF could not be parsed", error);
      throw new DocumentInputError(UNREADABLE_FILE);
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (extension === ".docx" || fileType.includes("word")) {
    const mammoth = await import("mammoth");
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error("DOCX could not be parsed", error);
      throw new DocumentInputError(UNREADABLE_FILE);
    }
  }

  throw new DocumentInputError(`Unsupported file type: ${extension || fileType}`);
}

export async function ingestUploadedFile(organizationId: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileType = file.type || path.extname(file.name).replace(".", "");
  const title = file.name.replace(/\.[^.]+$/, "");

  const document = await db.document.create({
    data: {
      organizationId,
      title,
      fileName,
      fileType,
      filePath: null,
      fileSize: buffer.length,
      status: "PROCESSING",
    },
  });

  try {
    const text = await extractTextFromBuffer(buffer, file.name, fileType);
    const chunks = chunkText(text.replaceAll("\0", ""));

    if (chunks.length === 0) {
      throw new DocumentInputError("No text could be extracted from this document");
    }

    await db.documentChunk.deleteMany({
      where: { documentId: document.id },
    });

    const embeddings = await createEmbeddings(chunks);

    await storeChunks(document.id, chunks, embeddings);

    return db.document.update({
      where: { id: document.id },
      data: {
        status: "READY",
        chunkCount: chunks.length,
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        errorMessage: failureMessage(error),
      },
    });

    throw error;
  }
}

export async function ingestTextDocument(
  organizationId: string,
  input: { title: string; content: string; fileName?: string },
) {
  const title = input.title.trim().slice(0, 120) || "FAQ draft";
  const content = input.content.trim();
  if (content.length < 40) {
    throw new DocumentInputError("FAQ content is too short to publish.");
  }
  if (content.length > MAX_FAQ_CONTENT_CHARS) {
    throw new DocumentInputError(
      `FAQ content must be ${MAX_FAQ_CONTENT_CHARS.toLocaleString("en-US")} characters or fewer.`,
      413,
    );
  }

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new DocumentInputError("No text could be extracted from this document");
  }

  const safeBase = title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "faq-draft";
  const fileName = input.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? `${safeBase}.md`;
  const buffer = Buffer.from(content, "utf-8");

  const document = await db.document.create({
    data: {
      organizationId,
      title,
      fileName,
      fileType: "text/markdown",
      filePath: null,
      fileSize: buffer.length,
      status: "PROCESSING",
    },
  });

  try {
    const embeddings = await createEmbeddings(chunks);

    await storeChunks(document.id, chunks, embeddings);

    return db.document.update({
      where: { id: document.id },
      data: {
        status: "READY",
        chunkCount: chunks.length,
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        errorMessage: failureMessage(error),
      },
    });

    throw error;
  }
}
