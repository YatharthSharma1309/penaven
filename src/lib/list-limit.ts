/** Dashboard lists show at most this many rows. */
export const LIST_LIMIT = 100;

/** Longest description sent to the ticket list. */
export const LIST_PREVIEW_LENGTH = 240;

export function isListLimited(total: number) {
  return total > LIST_LIMIT;
}

/** Null until the limit is hit, so short lists show no note. */
export function listLimitNote(total: number, noun: string) {
  if (!isListLimited(total)) return null;
  return `Showing the newest ${LIST_LIMIT} of ${total} ${noun}.`;
}

/** Cut long text for a list row without splitting an emoji in two. */
export function cutForList(text: string, maxLength = LIST_PREVIEW_LENGTH) {
  if (text.length <= maxLength) return text;

  const lastCode = text.charCodeAt(maxLength - 1);
  const endsOnHalfEmoji = lastCode >= 0xd800 && lastCode <= 0xdbff;
  const end = endsOnHalfEmoji ? maxLength - 1 : maxLength;

  return `${text.slice(0, end).trimEnd()}…`;
}
