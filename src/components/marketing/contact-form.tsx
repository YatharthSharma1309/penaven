"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_LIMITS,
  CONTACT_TOPIC_LABELS,
  CONTACT_TOPICS,
  TEAM_SIZES,
  type ContactField,
  type ContactFieldErrors,
  type ContactTopicValue,
} from "@/lib/contact/validation";
import { cn } from "@/lib/utils";

const GENERIC_ERROR =
  "We couldn't send your message right now. Please try again in a few minutes.";

const labelClass = "mb-2 block text-sm font-medium text-foreground";
const hintClass = "font-normal text-muted";

const NO_MAILING_LIST =
  "The team reads each message. Nothing is sent to you automatically, and you are not added to a mailing list.";

/** The intro under the page heading follows the topic picked in the form. */
const TOPIC_INTROS: Record<ContactTopicValue, string> = {
  enterprise: `SSO and a private deploy are not built yet. Say what your team would need. ${NO_MAILING_LIST}`,
  general: `Ask a question or tell us what is missing. ${NO_MAILING_LIST}`,
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}

export function ContactForm({
  initialTopic,
}: {
  initialTopic: ContactTopicValue;
}) {
  const successRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [topic, setTopic] = useState<ContactTopicValue>(initialTopic);

  const intro = (
    <p className="mt-2 text-sm leading-6 text-muted" aria-live="polite">
      {TOPIC_INTROS[topic]}
    </p>
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    setStatus("sending");
    setError(null);
    setFieldErrors({});

    let data: { error?: string; fieldErrors?: ContactFieldErrors } = {};
    let ok = false;
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      ok = response.ok;
      data = await response.json().catch(() => ({}));
    } catch {
      ok = false;
    }

    if (!ok) {
      const errors = data.fieldErrors ?? {};
      setFieldErrors(errors);
      setError(data.error ?? GENERIC_ERROR);
      setStatus("idle");
      const first = (Object.keys(errors) as ContactField[])[0];
      if (first) {
        form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      }
      return;
    }

    setStatus("sent");
    requestAnimationFrame(() => successRef.current?.focus());
  }

  function fieldProps(field: ContactField) {
    const message = fieldErrors[field];
    return {
      id: `contact-${field}`,
      name: field,
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `contact-${field}-error` : undefined,
      className: cn(message && "!border-danger"),
    };
  }

  if (status === "sent") {
    return (
      <>
        {intro}
        <Card className="mt-8">
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="flex gap-3 outline-none"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              aria-hidden
            />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Message received
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                Thanks. Your message is saved for the team to read. No email was
                sent.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/" className={buttonLinkClass}>
                  Back to home
                </Link>
                <button
                  type="button"
                  className={buttonLinkClass}
                  onClick={() => {
                    setStatus("idle");
                    setFieldErrors({});
                    setError(null);
                  }}
                >
                  Send another message
                </button>
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {intro}
      <Card className="mt-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-foreground"
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className={labelClass}>
                Name
              </label>
              <Input
                {...fieldProps("name")}
                autoComplete="name"
                required
                maxLength={CONTACT_LIMITS.name}
              />
              <FieldError id="contact-name-error" message={fieldErrors.name} />
            </div>
            <div>
              <label htmlFor="contact-email" className={labelClass}>
                Work email
              </label>
              <Input
                {...fieldProps("email")}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={CONTACT_LIMITS.email}
              />
              <FieldError
                id="contact-email-error"
                message={fieldErrors.email}
              />
            </div>
            <div>
              <label htmlFor="contact-company" className={labelClass}>
                Company <span className={hintClass}>(optional)</span>
              </label>
              <Input
                {...fieldProps("company")}
                autoComplete="organization"
                maxLength={CONTACT_LIMITS.company}
              />
              <FieldError
                id="contact-company-error"
                message={fieldErrors.company}
              />
            </div>
            <div>
              <label htmlFor="contact-teamSize" className={labelClass}>
                Team size <span className={hintClass}>(optional)</span>
              </label>
              <Select {...fieldProps("teamSize")} defaultValue="">
                <option value="">Choose one</option>
                {TEAM_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} people
                  </option>
                ))}
              </Select>
              <FieldError
                id="contact-teamSize-error"
                message={fieldErrors.teamSize}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-topic" className={labelClass}>
              Topic
            </label>
            <Select
              {...fieldProps("topic")}
              value={topic}
              onChange={(event) =>
                setTopic(event.target.value as ContactTopicValue)
              }
            >
              {CONTACT_TOPICS.map((value) => (
                <option key={value} value={value}>
                  {CONTACT_TOPIC_LABELS[value]}
                </option>
              ))}
            </Select>
            <FieldError id="contact-topic-error" message={fieldErrors.topic} />
          </div>

          <div>
            <label htmlFor="contact-message" className={labelClass}>
              Message
            </label>
            <Textarea
              {...fieldProps("message")}
              rows={6}
              required
              maxLength={CONTACT_LIMITS.message}
              placeholder="What would your team need, and roughly when?"
            />
            <FieldError
              id="contact-message-error"
              message={fieldErrors.message}
            />
          </div>

          {/* Honeypot: hidden from people and screen readers. Bots fill it in. */}
          <div
            aria-hidden="true"
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
          >
            <label htmlFor={`contact-${CONTACT_HONEYPOT_FIELD}`}>Website</label>
            <input
              id={`contact-${CONTACT_HONEYPOT_FIELD}`}
              name={CONTACT_HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : "Send message"}
            </Button>
            <p className="text-xs text-muted">
              Saved for the team to read. No email is sent.
            </p>
          </div>
        </form>
      </Card>
    </>
  );
}

const buttonLinkClass =
  "text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
