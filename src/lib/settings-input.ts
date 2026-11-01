import type { AgentTone } from "@/lib/settings";

export const SETTINGS_LIMITS = {
  greeting: 500,
  instructions: 4000,
  allowedOrigins: 50,
  /** Each origin must be shorter than this. */
  originLength: 300,
} as const;

const TONES: readonly string[] = ["professional", "friendly", "concise"];

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
/** A dotted hostname, as `hostnameMatchesAllowed` in lib/auth/widget.ts compares it. */
const DOTTED_HOST = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`, "i");

/** The forms the widget origin matcher can match: URL, `*.domain`, or bare host. */
function isAllowedOriginEntry(origin: string) {
  if (origin.startsWith("*.")) return DOTTED_HOST.test(origin.slice(2));
  if (!origin.includes("://")) {
    return origin.toLowerCase() === "localhost" || DOTTED_HOST.test(origin);
  }

  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.hostname.includes("*")
    );
  } catch {
    return false;
  }
}

export function parseAllowedOrigins(
  value: unknown,
): { origins: string[] } | { error: string } {
  if (!Array.isArray(value)) {
    return { error: "allowedOrigins must be a list of URLs." };
  }

  if (value.length > SETTINGS_LIMITS.allowedOrigins) {
    return {
      error: `Add at most ${SETTINGS_LIMITS.allowedOrigins} allowed origins.`,
    };
  }

  const origins: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return { error: "allowedOrigins must be a list of URLs." };
    }

    const origin = entry.trim();
    if (origin.length >= SETTINGS_LIMITS.originLength) {
      return {
        error: `Each allowed origin must be under ${SETTINGS_LIMITS.originLength} characters.`,
      };
    }
    if (!isAllowedOriginEntry(origin)) {
      return {
        error: `"${origin}" is not a valid origin. Use a URL like https://yourapp.com or a wildcard like *.yourapp.com.`,
      };
    }
    origins.push(origin);
  }

  return { origins };
}

export type AgentSettingsPatch = {
  greeting?: string;
  tone?: AgentTone;
  instructions?: string;
  allowedOrigins?: string[];
};

/** Checks a PATCH body. Fields left out stay as they are. */
export function parseAgentSettingsPatch(
  body: Record<string, unknown>,
): { patch: AgentSettingsPatch } | { error: string } {
  const patch: AgentSettingsPatch = {};

  if (body.greeting !== undefined) {
    if (typeof body.greeting !== "string") {
      return { error: "greeting must be a string." };
    }
    const greeting = body.greeting.trim();
    if (!greeting) return { error: "Greeting cannot be blank." };
    if (greeting.length > SETTINGS_LIMITS.greeting) {
      return {
        error: `Greeting must be ${SETTINGS_LIMITS.greeting} characters or fewer.`,
      };
    }
    patch.greeting = greeting;
  }

  if (body.tone !== undefined) {
    if (typeof body.tone !== "string" || !TONES.includes(body.tone)) {
      return { error: "tone must be professional, friendly, or concise." };
    }
    patch.tone = body.tone as AgentTone;
  }

  if (body.instructions !== undefined) {
    if (typeof body.instructions !== "string") {
      return { error: "instructions must be a string." };
    }
    const instructions = body.instructions.trim();
    if (instructions.length > SETTINGS_LIMITS.instructions) {
      return {
        error: `Instructions must be ${SETTINGS_LIMITS.instructions} characters or fewer.`,
      };
    }
    patch.instructions = instructions;
  }

  if (body.widget !== undefined) {
    if (!body.widget || typeof body.widget !== "object" || Array.isArray(body.widget)) {
      return { error: "widget must be an object." };
    }
    const { allowedOrigins } = body.widget as { allowedOrigins?: unknown };
    if (allowedOrigins !== undefined) {
      const parsed = parseAllowedOrigins(allowedOrigins);
      if ("error" in parsed) return parsed;
      patch.allowedOrigins = parsed.origins;
    }
  }

  return { patch };
}
