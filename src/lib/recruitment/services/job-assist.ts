import { RecruitmentError } from "@/lib/recruitment/errors";
import { createChatCompletion } from "@/lib/recruitment/openrouter";
import { buildJobAssistPrompt, parseJobAssistResult } from "@/lib/recruitment/prompts";
import type { JobAssistResult } from "@/lib/recruitment/types";

export async function generateJobCriteria(input: {
  title: string;
  description?: string;
}): Promise<JobAssistResult> {
  const { system, user } = buildJobAssistPrompt(input);
  const { content: raw } = await createChatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  try {
    return parseJobAssistResult(raw);
  } catch (error) {
    console.error("Job assistant output failed validation", error);
    throw new RecruitmentError(
      "The assistant returned an unusable answer. Try again.",
      502,
      "INVALID_JOB_ASSIST_JSON",
    );
  }
}
