/**
 * Markdown read as plain words: for one-line previews and cited passages,
 * where `**`, `#` and `- ` only mean something when rendered.
 * Lone `*` or `_` inside words (2*3, box_size) are left alone.
 */
export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/(^|[\s(])[*_](\S(?:[^*_\n]*?\S)?)[*_](?=[\s).,!?:;]|$)/gm, "$1$2");
}
