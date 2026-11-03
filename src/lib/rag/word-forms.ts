// Folds common English word endings so "refund", "refunds" and "refunded"
// compare equal in keyword search. It is a light rule set, not a full
// stemmer: the output is only ever compared with other output from this
// function, so it does not need to be a real word ("charge" -> "charg").

const KEEP_AS_IS = new Set(["news", "series", "species", "always", "perhaps"]);

const VOWEL = /[aeiouy]/;
const DOUBLE_CONSONANT = /([b-df-hj-np-tv-z])\1$/;

function hasVowel(stem: string) {
  return VOWEL.test(stem);
}

function stripPlural(word: string) {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (/(?:sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (/(?:ss|us|is)$/.test(word)) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function stripVerbEnding(word: string) {
  if (word.endsWith("ied") && word.length > 4) return `${word.slice(0, -3)}y`;

  const endings: Array<[suffix: string, minStem: number]> = [
    ["ation", 4],
    ["ing", 3],
    ["ed", 3],
  ];

  for (const [suffix, minStem] of endings) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (stem.length >= minStem && hasVowel(stem)) return stem;
    return word;
  }

  return word;
}

/** One lowercase token in, its folded form out. Tokens with digits are left alone. */
export function normalizeWordForm(token: string): string {
  const word = token.toLowerCase();
  if (word.length <= 3 || /[^a-z]/.test(word) || KEEP_AS_IS.has(word)) {
    return word;
  }

  let stem = stripVerbEnding(stripPlural(word));

  // "shipped" -> "shipp" and "cancelled" -> "cancell": fold the doubled
  // letter. Done for every word so "bill" and "billed" still agree.
  if (stem.length >= 4 && DOUBLE_CONSONANT.test(stem)) {
    stem = stem.slice(0, -1);
  }

  // "charge" and "charged" -> "charg"; "move" and "moving" -> "mov".
  if (stem.length >= 4 && stem.endsWith("e")) {
    stem = stem.slice(0, -1);
  }

  return stem;
}
