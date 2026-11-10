import { Fragment } from "react";

/**
 * Model replies sometimes mark emphasis with **double asterisks**. Show that as
 * bold text instead of literal asterisks. Everything stays plain React text, so
 * no HTML from a reply is ever interpreted.
 */
export function splitBold(text: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const pattern = /\*\*(?=\S)([^*\n]*?\S)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), bold: false });
    parts.push({ text: match[1], bold: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-semibold">
            {part.text}
          </strong>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
