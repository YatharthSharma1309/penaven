import { z } from "zod";

export const CONTACT_TOPICS = ["enterprise", "general"] as const;
export type ContactTopicValue = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopicValue, string> = {
  enterprise: "SSO or a private deploy",
  general: "Something else",
};

export const TEAM_SIZES = ["1-5", "6-20", "21-50", "51+"] as const;

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  company: 120,
  messageMin: 10,
  message: 2000,
} as const;

/** Per IP. Counts every POST that passes the header checks, including rejected bodies. */
export const CONTACT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;

/**
 * Shared bucket for requests with no trustworthy client IP. It is looser than
 * the per-IP limit so one noisy client cannot lock everyone else out; the
 * global cap below still bounds what gets stored.
 */
export const CONTACT_RATE_LIMIT_NO_IP = { limit: 20, windowMs: 60 * 60 * 1000 } as const;

/** Most ContactMessage rows stored across all senders in the last hour. */
export const CONTACT_GLOBAL_HOURLY_CAP = 50;

/** Largest request body accepted, in bytes. A full valid message is about 2.5 KB. */
export const CONTACT_MAX_BODY_BYTES = 16 * 1024;

/** The hidden field bots fill in. People never see it. */
export const CONTACT_HONEYPOT_FIELD = "website";

export function contactTopicFromParam(value: unknown): ContactTopicValue {
  const topic = Array.isArray(value) ? value[0] : value;
  return CONTACT_TOPICS.includes(topic as ContactTopicValue)
    ? (topic as ContactTopicValue)
    : "enterprise";
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => (value ? value : undefined));

export const contactSchema = z.object({
  name: z
    .string({ required_error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(CONTACT_LIMITS.name, `Name must be ${CONTACT_LIMITS.name} characters or fewer.`),
  email: z
    .string({ required_error: "Enter your email." })
    .trim()
    .min(1, "Enter your email.")
    .max(CONTACT_LIMITS.email, "That email is too long.")
    .email("Enter a valid email, like name@company.com."),
  company: optionalText(CONTACT_LIMITS.company, "Company"),
  teamSize: z
    .union([z.enum(TEAM_SIZES), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  topic: z.enum(CONTACT_TOPICS).default("enterprise"),
  message: z
    .string({ required_error: "Write a short message." })
    .trim()
    .min(CONTACT_LIMITS.messageMin, `Write at least ${CONTACT_LIMITS.messageMin} characters.`)
    .max(CONTACT_LIMITS.message, `Keep the message under ${CONTACT_LIMITS.message} characters.`),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export type ContactValidation =
  | { ok: true; data: ContactInput }
  | { ok: false; fieldErrors: ContactFieldErrors };

export function validateContact(input: unknown): ContactValidation {
  const parsed = contactSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: ContactFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] =
        issue.code === "invalid_type" || issue.code === "invalid_enum_value" || issue.code === "invalid_union"
          ? invalidTypeMessage(field)
          : issue.message;
    }
  }
  return { ok: false, fieldErrors };
}

function invalidTypeMessage(field: ContactField) {
  switch (field) {
    case "name":
      return "Enter your name.";
    case "email":
      return "Enter your email.";
    case "message":
      return "Write a short message.";
    case "teamSize":
      return "Choose a team size from the list.";
    case "topic":
      return "Choose a topic from the list.";
    default:
      return "Check this field.";
  }
}

/** True when the hidden honeypot field has any value. */
export function isHoneypotFilled(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const value = (input as Record<string, unknown>)[CONTACT_HONEYPOT_FIELD];
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}
