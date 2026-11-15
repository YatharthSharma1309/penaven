"use client";

import { useState } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildWidgetLauncherScript } from "@/lib/widget/embed-snippet";

type WidgetSettingsCardProps = {
  widgetPublicKey: string | null;
  widgetEnabled: boolean;
  allowedOrigins: string;
  appUrl: string;
  hasAppUrl: boolean;
};

export function WidgetSettingsCard({
  widgetPublicKey,
  widgetEnabled: initialEnabled,
  allowedOrigins: initialOrigins,
  appUrl,
  hasAppUrl,
}: WidgetSettingsCardProps) {
  const [widgetKey, setWidgetKey] = useState(widgetPublicKey ?? "");
  const [widgetEnabled, setWidgetEnabled] = useState(initialEnabled);
  const [allowedOrigins, setAllowedOrigins] = useState(initialOrigins);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);

  const embedUrl = widgetKey
    ? `${appUrl}/widget/embed?key=${widgetKey}`
    : `${appUrl}/widget/embed`;

  async function saveWidgetSettings() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/settings/widget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        widgetEnabled,
        allowedOrigins: allowedOrigins
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to save widget settings");
      setIsSaving(false);
      return;
    }

    setMessage("Widget settings saved.");
    setIsSaving(false);
  }

  async function generateKey() {
    setIsGenerating(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/settings/widget", {
      method: "POST",
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to generate widget key");
      setIsGenerating(false);
      return;
    }

    setWidgetKey(data.widgetPublicKey);
    setMessage("Widget key generated. Copy the launcher script below.");
    setIsGenerating(false);
  }

  async function rotateKey() {
    setIsRotating(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/settings/widget", {
      method: "POST",
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to rotate widget key");
      setIsRotating(false);
      return false;
    }

    setWidgetKey(data.widgetPublicKey);
    setMessage("Widget key rotated. Update embed snippets on customer sites.");
    setIsRotating(false);
    return true;
  }

  async function copyEmbed() {
    if (!widgetKey) {
      setError("Generate a widget key before copying the embed script.");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildWidgetLauncherScript(embedUrl));
      setMessage("Launcher script copied to clipboard.");
      setError(null);
    } catch {
      setError("Copy failed — select the snippet manually.");
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold text-foreground">Widget embed</h2>
      <p className="mt-2 text-sm text-muted">
        Share this key with your site embed. Visitors chat anonymously under your
        organization.
      </p>

      {!hasAppUrl ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          APP_URL is not set. Embed snippets use a localhost fallback and will not
          work on customer sites until you configure APP_URL in your environment.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="widget-key" className="mb-2 block text-sm font-medium text-foreground-soft">
            Publishable widget key
          </label>
          <div className="flex gap-2">
            <Input id="widget-key" value={widgetKey} readOnly placeholder="No key yet" />
            {widgetKey ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRotateDialogOpen(true)}
                disabled={isRotating}
              >
                {isRotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Rotate
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={generateKey} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate key
              </Button>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground-soft">
          <input
            type="checkbox"
            checked={widgetEnabled}
            onChange={(event) => setWidgetEnabled(event.target.checked)}
          />
          Widget enabled
        </label>

        <div>
          <label htmlFor="allowed-origins" className="mb-2 block text-sm font-medium text-foreground-soft">
            Allowed origins (one per line)
          </label>
          <textarea
            id="allowed-origins"
            className="min-h-[88px] w-full rounded-xl border border-border px-3 py-2 text-sm"
            value={allowedOrigins}
            onChange={(event) => setAllowedOrigins(event.target.value)}
            placeholder={"https://yourapp.com\nhttps://www.yourapp.com"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveWidgetSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save widget settings"}
          </Button>
          <Button type="button" variant="secondary" onClick={copyEmbed} disabled={!widgetKey}>
            <Copy className="h-4 w-4" />
            Copy launcher script
          </Button>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </div>

      <Dialog
        open={rotateDialogOpen}
        onOpenChange={setRotateDialogOpen}
        title="Rotate widget key?"
        description="Existing embed snippets on customer sites will stop working until you update them with the new key."
        confirmLabel="Rotate key"
        variant="danger"
        isLoading={isRotating}
        onConfirm={async () => {
          const rotated = await rotateKey();
          if (rotated) setRotateDialogOpen(false);
        }}
      />
    </Card>
  );
}
