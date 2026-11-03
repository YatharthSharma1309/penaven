import { db } from "@/lib/db";

export type AgentTone = "professional" | "friendly" | "concise";

export type WidgetSettings = {
  allowedOrigins?: string[];
};

export type AgentSettings = {
  greeting: string;
  tone: AgentTone;
  instructions: string;
  widget?: WidgetSettings;
};

/** The old default spoke to the owner ("your knowledge base"); customers see the greeting first. */
const LEGACY_DEFAULT_GREETING =
  "Hi! I'm grounded in your knowledge base. Ask about refunds, billing, API limits, or support hours — I'll cite my sources.";

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  greeting:
    "Hi! Ask a question and I'll answer from our help pages, with the source.",
  tone: "friendly",
  instructions:
    "Be accurate and helpful. If the answer is not in the knowledge base, say so and suggest escalating to a human agent.",
};

const TONE_HINTS: Record<AgentTone, string> = {
  professional:
    "Use a professional, clear tone suitable for B2B SaaS customers.",
  friendly: "Use a warm, approachable tone while staying concise.",
  concise: "Keep replies short and direct. Prefer bullet points when helpful.",
};

export function parseAgentSettings(raw: unknown): AgentSettings {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_AGENT_SETTINGS;
  }

  const value = raw as Partial<AgentSettings> & {
    widget?: WidgetSettings;
  };
  const tone =
    value.tone === "professional" ||
    value.tone === "friendly" ||
    value.tone === "concise"
      ? value.tone
      : DEFAULT_AGENT_SETTINGS.tone;

  return {
    greeting:
      typeof value.greeting === "string" &&
      value.greeting.trim() &&
      value.greeting.trim() !== LEGACY_DEFAULT_GREETING
        ? value.greeting.trim()
        : DEFAULT_AGENT_SETTINGS.greeting,
    tone,
    instructions:
      typeof value.instructions === "string" && value.instructions.trim()
        ? value.instructions.trim()
        : DEFAULT_AGENT_SETTINGS.instructions,
    widget:
      value.widget && typeof value.widget === "object"
        ? {
            allowedOrigins: Array.isArray(value.widget.allowedOrigins)
              ? value.widget.allowedOrigins.filter(
                  (origin): origin is string => typeof origin === "string",
                )
              : undefined,
          }
        : undefined,
  };
}

export function buildAgentSystemPrompt(settings: AgentSettings) {
  return [
    "You are a SaaS customer support assistant.",
    TONE_HINTS[settings.tone],
    settings.instructions,
    "Only answer using the provided context. Never invent policies or features.",
  ].join(" ");
}

export async function getAgentSettings(organizationId: string) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  return parseAgentSettings(organization?.settings);
}

export async function updateAgentSettings(
  organizationId: string,
  settings: AgentSettings,
) {
  return db.organization.update({
    where: { id: organizationId },
    data: { settings },
  });
}
