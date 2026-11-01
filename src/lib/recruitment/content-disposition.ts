/** Header values must be Latin-1, and RFC 6266 wants the plain name in ASCII. */
export function attachmentContentDisposition(fileName: string): string {
  // Control characters and lone surrogates have no place in a file name.
  const name = fileName.replace(/[\p{Cc}\p{Cs}]/gu, "").trim() || "resume";

  const fallback = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]|["\\%]/gu, "_");

  // encodeURIComponent leaves these four, and RFC 8187 does not allow them.
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
