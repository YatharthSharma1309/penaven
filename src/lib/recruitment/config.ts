function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RESUME_TRUNCATION_NOTICE = "\n\n[Truncated for analysis]";

export const appConfig = {
  maxUploadBytes: readInt(process.env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024),
  maxResumeTextChars: readInt(process.env.MAX_RESUME_TEXT_CHARS, 12_000),
  hireGraceMinutes: readInt(process.env.HIRE_GRACE_MINUTES, 10),
} as const;
