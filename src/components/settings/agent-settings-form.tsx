"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentSettings, AgentTone } from "@/lib/settings";

type AgentSettingsFormProps = {
  initialSettings: AgentSettings;
};

export function AgentSettingsForm({ initialSettings }: AgentSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [testQuestion, setTestQuestion] = useState(
    "What is the refund policy?",
  );
  const [testReply, setTestReply] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Origins are saved on the widget page. Sending them here would overwrite
      // that page's changes and fail this form on an origin it cannot edit.
      body: JSON.stringify({
        greeting: settings.greeting,
        tone: settings.tone,
        instructions: settings.instructions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to save settings");
      setIsSaving(false);
      return;
    }

    setSettings(data.settings);
    setMessage("Agent settings saved. New chats will use the updated greeting and tone.");
    setIsSaving(false);
  }

  async function runSandboxTest() {
    if (!testQuestion.trim()) return;

    setIsTesting(true);
    setError(null);
    setTestReply(null);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: testQuestion.trim(), sandbox: true }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Sandbox test failed");
      setIsTesting(false);
      return;
    }

    setTestReply(data.reply);
    setIsTesting(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <form onSubmit={saveSettings} className="space-y-5">
          <div>
            <label htmlFor="agent-greeting" className="mb-2 block text-sm font-medium text-slate-700">
              Welcome message
            </label>
            <Textarea
              id="agent-greeting"
              value={settings.greeting}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  greeting: event.target.value,
                }))
              }
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="agent-tone" className="mb-2 block text-sm font-medium text-slate-700">
              Tone
            </label>
            <Select
              id="agent-tone"
              value={settings.tone}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  tone: event.target.value as AgentTone,
                }))
              }
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="concise">Concise</option>
            </Select>
          </div>

          <div>
            <label htmlFor="agent-instructions" className="mb-2 block text-sm font-medium text-slate-700">
              Agent instructions
            </label>
            <Textarea
              id="agent-instructions"
              value={settings.instructions}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  instructions: event.target.value,
                }))
              }
              rows={4}
              placeholder="How should the agent behave when context is missing?"
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-900" />
          <h2 className="text-sm font-semibold text-slate-900">Test sandbox</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Send a one-off question with your current settings before deploying to chat or widget.
        </p>
        <label htmlFor="sandbox-question" className="sr-only">
          Test question
        </label>
        <Input
          id="sandbox-question"
          value={testQuestion}
          onChange={(event) => setTestQuestion(event.target.value)}
          placeholder="Ask a test question..."
        />
        <Button
          type="button"
          className="mt-3 w-full"
          variant="secondary"
          onClick={runSandboxTest}
          disabled={isTesting || !testQuestion.trim()}
        >
          {isTesting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" />
              Run test
            </>
          )}
        </Button>

        {testReply ? (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {testReply}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
