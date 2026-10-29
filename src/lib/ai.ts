import OpenAI from "openai";
import { isGeminiConfigured } from "@/lib/gemini";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_CHAT_MODEL = "openrouter/free";

const PLACEHOLDER_KEYS = new Set([
  "",
  "sk-your-openai-key",
  "your-openai-api-key",
  "sk-or-v1-your-openrouter-key",
  "changeme",
]);

let aiClient: OpenAI | null = null;

function getApiKey() {
  for (const value of [process.env.OPENROUTER_API_KEY, process.env.OPENAI_API_KEY]) {
    const key = value?.trim();
    if (key && !PLACEHOLDER_KEYS.has(key)) {
      return key;
    }
  }
  return null;
}

export function getChatModel() {
  return (
    process.env.OPENROUTER_CHAT_MODEL?.trim() ||
    process.env.AI_CHAT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL
  );
}

export function getEmbeddingModel() {
  return process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || "";
}

export function isEmbeddingEnabled() {
  return Boolean(getEmbeddingModel());
}

export function getAiClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  if (!aiClient) {
    aiClient = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL?.trim() || "http://localhost:3000",
        "X-Title": "Penaven",
      },
    });
  }

  return aiClient;
}

export function isAiConfigured() {
  return Boolean(getApiKey()) || isGeminiConfigured();
}

export function isOpenRouterConfigured() {
  return Boolean(getApiKey());
}

/**
 * Controls which LLM is tried first.
 * - `openrouter` / `free` — skip Gemini (no paid quota; uses OpenRouter free models)
 * - `gemini` — try Gemini first when configured
 * - `auto` — try Gemini first when configured, then OpenRouter (default)
 */
export function getAiProviderPreference(): "openrouter" | "gemini" | "auto" {
  const raw = (
    process.env.AI_PROVIDER_PREFERENCE ||
    process.env.LLM_PROVIDER ||
    "auto"
  )
    .trim()
    .toLowerCase();

  if (raw === "openrouter" || raw === "free" || raw === "fallback") {
    return "openrouter";
  }
  if (raw === "gemini") {
    return "gemini";
  }
  return "auto";
}

/** Whether chat should attempt Gemini before OpenRouter. */
export function shouldAttemptGemini() {
  if (!isGeminiConfigured()) return false;
  return getAiProviderPreference() !== "openrouter";
}
