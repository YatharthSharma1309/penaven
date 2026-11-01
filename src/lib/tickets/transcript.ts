import { TICKET_LIMITS } from "@/lib/tickets/constants";

const TRIMMED_NOTE =
  "[Earlier messages trimmed. The full conversation is linked to this ticket.]";

/**
 * Builds a ticket description from chat turns. A long chat keeps its newest
 * turns, because triage and the unanswered check read the last reply. The
 * ticket links the conversation, so nothing is lost from the record.
 */
export function buildEscalationTranscript(
  turns: Array<{ role: string; content: string }>,
  limit: number = TICKET_LIMITS.description,
) {
  const lines = turns.map((turn) => `${turn.role}: ${turn.content}`);
  const full = lines.join("\n\n");
  if (full.length <= limit) return full;

  const room = limit - TRIMMED_NOTE.length - 2;
  const kept: string[] = [];
  let used = 0;

  for (const line of [...lines].reverse()) {
    const cost = line.length + (kept.length > 0 ? 2 : 0);
    if (used + cost > room) break;
    kept.unshift(line);
    used += cost;
  }

  // A single reply can be longer than the limit by itself.
  if (kept.length === 0) kept.push(lines[lines.length - 1].slice(0, room));

  return [TRIMMED_NOTE, ...kept].join("\n\n");
}
