"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_LIMITS } from "@/lib/tickets/constants";

export function CreateTicketForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to create ticket");
      setIsSubmitting(false);
      return;
    }

    router.push(`/tickets/${data.ticket.id}`);
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="ticket-title" className="mb-2 block text-sm font-medium text-slate-700">
            Title
          </label>
          <Input
            id="ticket-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={TICKET_LIMITS.title}
            placeholder="Billing issue with annual plan"
          />
        </div>

        <div>
          <label htmlFor="ticket-description" className="mb-2 block text-sm font-medium text-slate-700">
            Description
          </label>
          <Textarea
            id="ticket-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={TICKET_LIMITS.description}
            rows={6}
            placeholder="Describe the customer issue in detail..."
          />
        </div>

        <div>
          <label htmlFor="ticket-priority" className="mb-2 block text-sm font-medium text-slate-700">
            Priority
          </label>
          <Select
            id="ticket-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create ticket"}
        </Button>
      </form>
    </Card>
  );
}
