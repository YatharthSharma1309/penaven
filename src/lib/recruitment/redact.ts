/**
 * Strip personal details from resume text before the AI screen sees it.
 *
 * LLM resume rankers show name-driven race and gender bias, so the model gets the
 * work history without the name, contact details, links, or labelled personal
 * fields (DOB, gender, religion, ...). The stored resume is never changed: this
 * runs on a copy that only goes to the model and the score check.
 */

export const REDACTED = {
  email: "[email]",
  phone: "[phone]",
  link: "[link]",
  name: "[name]",
  personal: "[personal detail removed]",
  photo: "[photo removed]",
} as const;

export type RedactOptions = {
  /** Words never treated as name tokens, such as the job's skills ("Ruby", "Swift"). */
  keepTerms?: string[];
};

// Labels whose value is personal, not work evidence. Short, ambiguous words need a
// colon or dash after them; the longer labels are matched with or without one.
const STRICT_LABELS = ["age", "sex", "gender", "religion", "caste", "photo", "photograph"];
const LOOSE_LABELS = [
  "date of birth",
  "birth date",
  "birthdate",
  "d\\.?o\\.?b\\.?",
  "marital status",
  "civil status",
  "nationality",
  "father'?s name",
  "father name",
  "mother'?s name",
  "mother name",
  "husband'?s name",
  "spouse name",
  "spouse'?s name",
];
// A field starts a line or follows a separator ("Email: x | DOB: y", "DOB: y, Gender: z").
// A run of 2+ spaces is matched whole (no space may come before or after it), so a
// long run of spaces cannot be split many ways and matching stays linear.
const SEGMENT_START = "(^|[|•·;,]|(?<![ \\t])[ \\t]{2,}(?![ \\t]))([ \\t]*)";
// The value stops at a separator or a comma ("Gender: Male, Skills: SQL" keeps the
// skills), except a comma before a digit ("12 March, 1995"), and is at most 40
// characters, so a stray label never swallows a line of work history.
const FIELD_VALUE = "(?:[^|•·;,\\r\\n]|,(?=[ \\t]*\\d)){0,40}";

const LOOSE_LABEL = `(?:${LOOSE_LABELS.join("|")})(?![\\w])[ \\t]*(?:[:：\\-–—][ \\t]*)?`;
// Short labels need a colon, or a dash before a number or one word ending the field
// ("Age - 28", "Gender - Female"). "age - gating logic" is work, not a personal field.
const STRICT_LABEL = `(?:${STRICT_LABELS.join("|")})[ \\t]*(?:[:：]|[ \\t][\\-–—][ \\t](?=\\d|[A-Za-z]+[ \\t]*(?:$|[,|•·;])))`;
const PERSONAL_FIELD = new RegExp(
  `${SEGMENT_START}(?:${LOOSE_LABEL}|${STRICT_LABEL})(${FIELD_VALUE})`,
  "gim",
);

const PHOTO_LINE =
  // No two space groups side by side, so a line of spaces cannot backtrack quadratically.
  /^[ \t]*(?:[[(<][ \t]*)?(?:passport[- ]size[ \t]+)?(?:photo(?:graph)?|profile[ \t]+(?:photo|picture|image)|headshot|picture|image)(?:[ \t]+(?:attached|enclosed|here|below|above))?(?:[ \t]*[\])>])?[ \t]*$/gim;
const IMAGE_FILE = /\b[\w-]+\.(?:jpe?g|png|gif|webp|heic|bmp)\b/gi;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;

const URL_WITH_SCHEME = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;
const PROFILE_DOMAINS =
  "linkedin\\.com|github\\.com|gitlab\\.com|bitbucket\\.org|twitter\\.com|x\\.com|instagram\\.com|facebook\\.com|medium\\.com|behance\\.net|dribbble\\.com|stackoverflow\\.com|kaggle\\.com|leetcode\\.com|hackerrank\\.com|codepen\\.io|github\\.io|vercel\\.app|netlify\\.app";
const PROFILE_URL = new RegExp(
  `\\b(?:[\\w-]+\\.)*(?:${PROFILE_DOMAINS})(?:\\/[^\\s<>()"']*)?`,
  "gi",
);
// "GitHub: jdoe", "LinkedIn - jane-doe-123", "Portfolio: janedoe.dev"
const HANDLE_FIELD =
  /\b(linkedin|github|gitlab|twitter|instagram|portfolio|website|personal site|blog|behance|dribbble|leetcode|hackerrank|kaggle|stack ?overflow)([ \t]*(?:[:：]|[ \t][-–—][ \t])[ \t]*)@?[^\s|•·;,]+/gi;

// Digits with phone-style separators. Checked further in looksLikePhone.
// Spaces are allowed only after a "+" or "00" prefix, so a match never starts inside a
// run of spaces (that made long space runs quadratic).
const PHONE_CANDIDATE = new RegExp("(?<![\\w+])(?:(?:\\+|00)[ \\t]*)?\\(?\\d[\\d \\t().-]{6,}\\d(?![\\w])", "g");

const NAME_STOPWORDS = new Set([
  "resume",
  "cv",
  "pdf",
  "doc",
  "docx",
  "txt",
  "final",
  "updated",
  "latest",
  "new",
  "copy",
  "candidate",
  "profile",
  "the",
  "and",
]);

function trimTrailingPunctuation(match: string): { kept: string; tail: string } {
  const tail = /[.,;:!?)\]}'"]+$/.exec(match)?.[0] ?? "";
  return { kept: match.slice(0, match.length - tail.length), tail };
}

function looksLikePhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  const international = /^[ \t]*(?:\+|00)/.test(candidate);
  if (digits.length > 15) return false;
  if (digits.length < (international ? 8 : 10)) return false;

  const groups = candidate.match(/\d+/g) ?? [];
  // "2019-2023 2023-2024": every group is a year.
  if (groups.every((group) => group.length === 4 && /^(?:19|20)\d\d$/.test(group))) {
    return false;
  }
  // "2013 - 2023 (10 years)": a year range with a count.
  if (/(?:19|20)\d\d[ \t]*[-.][ \t]*(?:19|20)\d\d/.test(candidate)) return false;
  // "01-02-2020 03-04-2021", "2020.01.15": calendar dates.
  if (/(?:^|\D)\d{1,2}[-.]\d{1,2}[-.](?:19|20)\d\d(?:\D|$)/.test(candidate)) return false;
  if (/(?:^|\D)(?:19|20)\d\d[-.]\d{1,2}[-.]\d{1,2}(?:\D|$)/.test(candidate)) return false;
  // 192.168.1.10
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate.trim())) return false;
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nameTokens(displayName: string | null | undefined, keepTerms: string[] = []): string[] {
  if (!displayName) return [];
  // "Ruby on Rails" keeps "ruby" as well as the whole term.
  const keep = new Set(
    keepTerms
      .flatMap((term) => [term, ...term.split(/[\s/,()]+/)])
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const raw of displayName.split(/[^\p{L}\p{M}'’-]+/u)) {
    const token = raw.replace(/^['’-]+|['’-]+$/g, "");
    const parts = /[-'’]/.test(token) ? [token, ...token.split(/[-'’]+/)] : [token];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (part.length < 2 || NAME_STOPWORDS.has(key) || keep.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      tokens.push(part);
    }
  }

  // Longest first, so "Anne-Marie" goes before "Anne".
  return tokens.sort((a, b) => b.length - a.length);
}

function redactName(text: string, tokens: string[]): string {
  if (tokens.length === 0) return text;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])(?:${tokens.map(escapeRegExp).join("|")})(?:['’]s)?(?![\\p{L}\\p{M}\\p{N}])`,
    "giu",
  );
  return text.replace(pattern, REDACTED.name);
}

/**
 * No usable display name (it fell back to "Candidate" or a file name): hide the
 * first line when it looks like a name, the usual top line of a resume.
 * Known limits: an employer that shares the candidate's first name is hidden too,
 * and spelled-out emails ("jane [at] gmail") are not caught.
 */
function redactHeaderName(text: string): string {
  return text.replace(
    /^(\s*)(\p{Lu}[\p{L}\p{M}'’.-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}'’.-]*){1,3})[ \t]*(?=\r?\n|$)/u,
    (match, lead: string, line: string) =>
      /\b(?:resume|curriculum|vitae|cv|profile|summary|engineer|developer|manager|designer|analyst|consultant|lead|intern|executive|specialist|officer|director)\b/i.test(line)
        ? match
        : `${lead}${REDACTED.name}`,
  );
}

/** Collapse "[name] [name]" from a first and last name into one placeholder. */
function collapseRepeats(text: string): string {
  return text.replace(/\[name\](?:[ \t]+\[name\])+/g, REDACTED.name);
}

export function redactForScreening(
  text: string,
  displayName?: string | null,
  options: RedactOptions = {},
): string {
  let out = text;

  out = out.replace(
    PERSONAL_FIELD,
    (_match, start: string, space: string, value: string) =>
      `${start}${space}${REDACTED.personal}${/[ \t]*$/.exec(value)?.[0] ?? ""}`,
  );
  out = out.replace(PHOTO_LINE, REDACTED.photo);
  out = out.replace(IMAGE_FILE, REDACTED.photo);

  out = out.replace(EMAIL, REDACTED.email);
  out = out.replace(URL_WITH_SCHEME, (match) => {
    const { tail } = trimTrailingPunctuation(match);
    return `${REDACTED.link}${tail}`;
  });
  out = out.replace(PROFILE_URL, (match) => {
    const { tail } = trimTrailingPunctuation(match);
    return `${REDACTED.link}${tail}`;
  });
  out = out.replace(HANDLE_FIELD, (match, label: string, separator: string) => {
    const value = match.slice(label.length + separator.length);
    if (value.startsWith("[")) return match;
    const { tail } = trimTrailingPunctuation(value);
    return `${label}${separator}${REDACTED.link}${tail}`;
  });

  out = out.replace(PHONE_CANDIDATE, (match) => {
    if (!looksLikePhone(match)) return match;
    const lead = /^[ \t]*/.exec(match)?.[0] ?? "";
    return `${lead}${REDACTED.phone}`;
  });

  const tokens = nameTokens(displayName, options.keepTerms);
  out = tokens.length > 0 ? redactName(out, tokens) : redactHeaderName(out);
  return collapseRepeats(out);
}
