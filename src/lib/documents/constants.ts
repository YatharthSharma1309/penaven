export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Longest FAQ topic that can be drafted. */
export const MAX_FAQ_TOPIC_CHARS = 200;

/** Longest FAQ that can be published. A draft runs to about 3,000 characters. */
export const MAX_FAQ_CONTENT_CHARS = 20_000;

export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
] as const;

export function isAllowedUpload(file: File) {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";

  const mimeAllowed =
    !file.type ||
    ALLOWED_UPLOAD_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
    );

  return (
    ALLOWED_UPLOAD_EXTENSIONS.includes(
      extension as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number],
    ) && mimeAllowed
  );
}
