"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EscalationTriageCard } from "@/components/tickets/escalation-triage-card";
import {
  priorityTone,
  statusTone,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/tickets/constants";
import { formatDate } from "@/lib/utils";

type TicketDetailProps = {
  ticket: {
    id: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    triage?: unknown;
    createdAt: string;
    conversationId: string | null;
    assigneeId: string | null;
    assignee: { id: string; name: string } | null;
    comments: Array<{
      id: string;
      content: string;
      createdAt: string;
      author: { name: string } | null;
    }>;
    conversation: {
      id: string;
      title: string | null;
      channel?: string;
      messages: Array<{
        id: string;
        role: "USER" | "ASSISTANT" | "SYSTEM";
        content: string;
        createdAt: string;
      }>;
    } | null;
  };
  teamMembers: Array<{ id: string; name: string }>;
};

export function TicketDetail({ ticket, teamMembers }: TicketDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(ticket.status);
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId ?? "");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: TicketStatus) {
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to update ticket");
      setIsSaving(false);
      return;
    }

    setStatus(nextStatus);
    setIsSaving(false);
    router.refresh();
  }

  async function updateAssignee(nextAssigneeId: string) {
    setAssigneeId(nextAssigneeId);
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigneeId: nextAssigneeId || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to update assignee");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    router.refresh();
  }

  async function suggestReply() {
    setIsSuggesting(true);
    setError(null);

    const response = await fetch(`/api/tickets/${ticket.id}/suggest-reply`, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to generate suggestion");
      setIsSuggesting(false);
      return;
    }

    setComment(data.suggestion);
    setIsSuggesting(false);
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/tickets/${ticket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to add comment");
      setIsSaving(false);
      return;
    }

    setComment("");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{ticket.title}</h2>
            <Badge tone={statusTone[status]}>
              {status.replace("_", " ").toLowerCase()}
            </Badge>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {ticket.description}
          </p>

          {ticket.triage ? <EscalationTriageCard triage={ticket.triage} /> : null}

          {ticket.title.startsWith("Escalation:") ? (
            <div className="mt-4">
              <Link
                href={`/analytics?gap=${encodeURIComponent(
                  ticket.title.replace(/^Escalation:\s*/i, "").slice(0, 120),
                )}#knowledge-gaps`}
                className={buttonClassName({ variant: "secondary", size: "sm" })}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Draft a page from this question
              </Link>
            </div>
          ) : null}

          {ticket.conversation ? (
            <div className="mt-8 rounded-2xl border border-primary/15 bg-primary-soft/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    The conversation
                  </h3>
                </div>
                <Link
                  href={
                    ticket.conversation.channel &&
                    ticket.conversation.channel !== "ADMIN"
                      ? `/inbox/${ticket.conversation.id}`
                      : `/chat?conversation=${ticket.conversation.id}`
                  }
                  className="text-xs font-medium text-blue-900 hover:text-blue-800"
                >
                  {ticket.conversation.channel &&
                  ticket.conversation.channel !== "ADMIN"
                    ? "Open inbox thread"
                    : "Open chatbot"}
                </Link>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {ticket.conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-100"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {message.role.toLowerCase()}
                    </p>
                    <p className="mt-1 text-slate-700">{message.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={submitComment} className="mt-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="ticket-comment" className="block text-sm font-medium text-slate-700">
                Add comment
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={suggestReply}
                disabled={isSuggesting}
              >
                <Sparkles className="h-4 w-4" />
                {isSuggesting ? "Drafting..." : "Suggest reply"}
              </Button>
            </div>
            <Textarea
              id="ticket-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Write an update for this ticket..."
            />
            <Button type="submit" disabled={isSaving || !comment.trim()}>
              Post comment
            </Button>
          </form>

          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Activity
            </h3>
            {ticket.comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet.</p>
            ) : (
              ticket.comments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 px-4 py-3"
                >
                  <p className="text-sm text-slate-800">{item.content}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {item.author?.name ?? "System"} · {formatDate(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="h-fit space-y-5">
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <Badge tone={statusTone[status]} className="mt-2">
              {status.replace("_", " ").toLowerCase()}
            </Badge>
          </div>

          <div>
            <p className="text-sm text-slate-500">Priority</p>
            <Badge tone={priorityTone[ticket.priority]} className="mt-2">
              {ticket.priority.toLowerCase()}
            </Badge>
          </div>

          <div>
            <label htmlFor="ticket-assignee" className="text-sm text-slate-500">
              Assignee
            </label>
            <Select
              id="ticket-assignee"
              className="mt-2"
              value={assigneeId}
              onChange={(event) => updateAssignee(event.target.value)}
              disabled={isSaving}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="text-sm text-slate-500">Created</p>
            <p className="mt-2 text-sm text-slate-800">
              {formatDate(ticket.createdAt)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Update status</p>
            {TICKET_STATUSES.map((item) => (
              <Button
                key={item}
                variant={status === item ? "primary" : "secondary"}
                size="sm"
                className="w-full justify-start"
                disabled={isSaving}
                onClick={() => updateStatus(item)}
              >
                {item.replace("_", " ").toLowerCase()}
              </Button>
            ))}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </Card>
      </div>
    </div>
  );
}
