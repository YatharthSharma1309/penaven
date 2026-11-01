/** pdf-parse puts a "-- 1 of 4 --" line after every page, even a blank one. */
const PDF_PAGE_MARKER_LINE = /^[ \t]*--[ \t]*\d+[ \t]+of[ \t]+\d+[ \t]*--[ \t]*$/gm;

export function stripPdfPageMarkers(text: string): string {
  return text.replace(PDF_PAGE_MARKER_LINE, "").replace(/\n{3,}/g, "\n\n");
}
