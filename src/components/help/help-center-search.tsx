"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronUp, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rankChunksByKeywords } from "@/lib/rag/retrieve";

type HelpArticle = {
  id: string;
  title: string;
  chunks: Array<{ id: string; content: string; chunkIndex: number }>;
};

type HelpCenterSearchProps = {
  articles: HelpArticle[];
  widgetKey?: string | null;
  onAskAi?: (question: string) => void;
};

export function HelpCenterSearch({
  articles,
  widgetKey,
  onAskAi,
}: HelpCenterSearchProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const flatChunks = useMemo(
    () =>
      articles.flatMap((article) =>
        article.chunks.map((chunk) => ({
          id: chunk.id,
          documentId: article.id,
          content: chunk.content,
          documentTitle: article.title,
        })),
      ),
    [articles],
  );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return rankChunksByKeywords(query, flatChunks, 8);
  }, [flatChunks, query]);

  function askAi(question: string) {
    onAskAi?.(question.trim());
  }

  function toggleArticle(articleId: string) {
    setExpanded((current) => ({
      ...current,
      [articleId]: !current[articleId],
    }));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="help-search" className="sr-only">
            Search help articles
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            id="help-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search refunds, billing, API limits..."
            className="pl-11"
          />
        </div>
        {widgetKey && onAskAi ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => askAi(query.trim() || "How can you help me?")}
          >
            <Bot className="h-4 w-4" />
            Ask AI
          </Button>
        ) : null}
      </div>

      {query.trim() ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Search results
            </h2>
            {widgetKey && onAskAi ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => askAi(query.trim())}
              >
                <Bot className="h-4 w-4" />
                Ask AI about this
              </Button>
            ) : null}
          </div>
          {searchResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-sunken/70 px-4 py-6 text-center">
              <p className="text-sm text-muted">
                No matching articles. Try different keywords
                {widgetKey ? " or ask the AI chatbot." : "."}
              </p>
              {widgetKey && onAskAi ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={() => askAi(query.trim())}
                >
                  <Bot className="h-4 w-4" />
                  Ask AI
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((result) => (
                <article
                  key={result.id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-medium text-blue-900">
                      {result.documentTitle}
                    </p>
                    {widgetKey && onAskAi ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-900 hover:text-blue-800"
                        onClick={() => askAi(result.content.slice(0, 120))}
                      >
                        Ask AI
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground-soft">
                    {result.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          All articles
        </h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">
            No articles published yet. Check back soon or contact support.
          </p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              const isOpen = expanded[article.id] ?? false;
              const panelId = `article-panel-${article.id}`;

              return (
                <article
                  key={article.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleArticle(article.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-sunken"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-900">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{article.title}</p>
                        <p className="text-xs text-muted">
                          {article.chunks.length} sections
                        </p>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    )}
                  </button>

                  {isOpen ? (
                    <div
                      id={panelId}
                      className="space-y-3 border-t border-hairline px-5 py-4"
                    >
                      {article.chunks.map((chunk) => (
                        <div
                          key={chunk.id}
                          className="rounded-xl bg-surface-sunken px-4 py-3 text-sm leading-6 text-foreground-soft"
                        >
                          {chunk.content}
                        </div>
                      ))}
                      {widgetKey && onAskAi ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => askAi(`Tell me about ${article.title}`)}
                        >
                          <Bot className="h-4 w-4" />
                          Ask AI about this article
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
