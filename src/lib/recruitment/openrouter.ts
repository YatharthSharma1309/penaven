import { getAiClient, getChatModel } from "@/lib/ai";
import { usageFromProviderCounts, type ModelUsage } from "@/lib/billing/cost";
import { RecruitmentError } from "@/lib/recruitment/errors";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  messages: ChatMessage[];
  temperature?: number;
  model?: string;
};

export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<{ content: string; usage: ModelUsage | null }> {
  const client = getAiClient();
  if (!client) {
    throw new RecruitmentError(
      "The assistant is not configured.",
      503,
      "MISSING_API_KEY"
    );
  }

  const model = options.model ?? getChatModel();

  const response = await client.chat.completions.create({
    model,
    temperature: options.temperature ?? 0.3,
    messages: options.messages,
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new RecruitmentError("Model returned an empty response.", 502, "EMPTY_MODEL");
  }

  return {
    content: content.trim(),
    usage: usageFromProviderCounts(
      response.usage?.prompt_tokens,
      response.usage?.completion_tokens,
    ),
  };
}
