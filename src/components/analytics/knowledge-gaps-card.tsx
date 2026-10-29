"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeGap = {
  topic: string;
  count: number;
  kind?: "unanswered" | "marked_wrong";
};

type KnowledgeGapsCardProps = {
  knowledgeGaps: KnowledgeGap[];
  canPublish: boolean;
};

type DraftState = {
  topic: string;
  title: string;
  content: string;
};

export function KnowledgeGapsCard({
  knowledgeGaps,
  canPublish,
}: KnowledgeGapsCardProps) {
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const autoDraftedRef = useRef(false);

  async function draftFaq(topic: string) {
    setIsDrafting(true);
    setActiveTopic(topic);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/knowledge/draft-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to draft FAQ");
        setDraft(null);
        return;
      }

      setDraft({
        topic,
        title: data.draft.title,
        content: data.draft.content,
      });
    } catch {
      setError("Network error while drafting FAQ.");
      setDraft(null);
    } finally {
      setIsDrafting(false);
    }
  }

  useEffect(() => {
    if (autoDraftedRef.current) return;
    const gapTopic = searchParams.get("gap")?.trim();
    if (!gapTopic) return;
    autoDraftedRef.current = true;
    const timer = window.setTimeout(() => {
      void draftFaq(gapTopic);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  async function publishFaq() {
    if (!draft || !canPublish) return;

    setIsPublishing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/knowledge/publish-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          content: draft.content.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to publish FAQ");
        return;
      }

      setSuccess(`Published "${draft.title.trim()}" to the knowledge base.`);
      setDraft(null);
      setActiveTopic(null);
    } catch {
      setError("Network error while publishing FAQ.");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Card id="knowledge-gaps">
      <CardTitle>Knowledge gaps</CardTitle>
      <CardDescription>
        Questions the docs did not cover, and answers someone marked wrong.
        Draft a short page, edit it, then add it.
      </CardDescription>

      <div className="mt-5 space-y-3">
        {knowledgeGaps.length === 0 ? (
          <p className="text-sm text-slate-500">
            No unanswered or marked-wrong questions yet. Gaps show up when a reply says the docs do not cover the ask, or when someone marks an answer wrong.
          </p>
        ) : (
          knowledgeGaps.map((gap, index) => (
            <div
              key={`${gap.topic}-${index}`}
              className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{gap.topic}</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  {gap.kind === "marked_wrong" ? "Marked wrong" : "Unanswered"}
                  {gap.count > 1 ? ` · ${gap.count}x` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isDrafting}
                onClick={() => void draftFaq(gap.topic)}
              >
                {isDrafting && activeTopic === gap.topic ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Draft a page
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </div>

      {draft ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-primary/15 bg-primary-soft/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Draft page
          </div>
          <p className="text-xs text-slate-600">From the question: {draft.topic}</p>
          <div>
            <label htmlFor="faq-title" className="mb-1.5 block text-sm font-medium text-slate-700">
              Title
            </label>
            <Input
              id="faq-title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, title: event.target.value } : current,
                )
              }
            />
          </div>
          <div>
            <label htmlFor="faq-content" className="mb-1.5 block text-sm font-medium text-slate-700">
              Content
            </label>
            <Textarea
              id="faq-content"
              rows={12}
              value={draft.content}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, content: event.target.value } : current,
                )
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canPublish ? (
              <Button
                type="button"
                onClick={() => void publishFaq()}
                disabled={isPublishing || !draft.title.trim() || !draft.content.trim()}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Add to the docs"
                )}
              </Button>
            ) : (
              <p className="text-sm text-slate-500">
                Ask an admin to publish this draft to the knowledge base.
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(null);
                setActiveTopic(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      {success ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-sm text-accent">
          <span>{success}</span>
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Open knowledge
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
