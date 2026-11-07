"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Summary = {
  site: string;
  imported: Array<{ title: string; url: string; truncated: boolean }>;
  skipped: Array<{ url: string; reason: string }>;
  stoppedEarly: boolean;
};

export function SiteImport({ onImported }: { onImported: () => void }) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    if (!address.trim()) {
      setError("Enter a website address such as https://example.com.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/documents/import-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: address }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.summary) setSummary(data.summary);
      if (!response.ok) {
        setError(data.error ?? "The website could not be imported.");
      } else {
        onImported();
      }
    } catch {
      setError("The import did not finish. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6"
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-900">
            <Globe className="h-4 w-4" />
            <p className="font-medium">Import from your website</p>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Reads up to 25 public pages of one site, such as your FAQ, shipping and returns pages. Pages the
            site&apos;s robots.txt blocks are skipped. Importing again replaces pages already imported.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <label htmlFor="site-import-url" className="sr-only">
            Website address
          </label>
          <input
            id="site-import-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourstore.com/faq"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:w-72"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Reading pages…" : "Import"}
          </Button>
        </div>
      </div>

      {busy ? (
        <p className="mt-3 text-sm text-slate-500">This can take up to a minute.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {summary && summary.imported.length > 0 ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-medium text-emerald-700">
            Imported {summary.imported.length} page{summary.imported.length === 1 ? "" : "s"} from {summary.site}.
            {summary.stoppedEarly ? " The import stopped at its limit, so some pages were left out." : ""}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            {summary.imported.map((page) => (
              <li key={page.url} className="break-words">
                {page.title}
                {page.truncated ? " (first part only)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.skipped.length > 0 ? (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer">
            {summary.skipped.length} page{summary.skipped.length === 1 ? "" : "s"} skipped
          </summary>
          <ul className="mt-2 space-y-1 pl-5">
            {summary.skipped.slice(0, 50).map((page) => (
              <li key={page.url} className="break-words">
                <span className="text-slate-800">{page.url}</span>: {page.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </form>
  );
}
