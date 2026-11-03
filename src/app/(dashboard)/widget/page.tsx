import Link from "next/link";
import { Code2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { EmbedSnippetCopy } from "@/components/widget/embed-snippet-copy";
import { FloatingWidget } from "@/components/widget/floating-widget";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAgentSettings } from "@/lib/settings";
import { buildWidgetIframeMarkup, buildWidgetLauncherScript } from "@/lib/widget/embed-snippet";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const hasAppUrl = Boolean(process.env.APP_URL);

export default async function WidgetPage() {
  const { organization, role } = await requireOrgMembershipOrRedirect();
  const isAdmin = role === "ADMIN";
  const widgetKey = organization.widgetPublicKey ?? "";
  const widgetEnabled = organization.widgetEnabled;
  const embedUrl = widgetKey
    ? `${appUrl}/widget/embed?key=${encodeURIComponent(widgetKey)}`
    : null;

  const [readyDocuments, settings] = await Promise.all([
    db.document.count({
      where: { organizationId: organization.id, status: "READY" },
    }),
    getAgentSettings(organization.id),
  ]);
  const hasDocuments = readyDocuments > 0;
  const launcherScript = embedUrl ? buildWidgetLauncherScript(embedUrl) : null;
  const iframeMarkup = embedUrl ? buildWidgetIframeMarkup(embedUrl) : null;

  return (
    <>
      <Header
        title="Embeddable Widget"
        description="Preview the chat bubble and copy embed code for your site."
        action={
          embedUrl && widgetEnabled ? (
            <Link
              href="#iframe-embed"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              <Code2 className="h-4 w-4" />
              Embed code
            </Link>
          ) : null
        }
      />

      <main id="main-content" className="relative mx-auto max-w-5xl flex-1 px-4 py-6 sm:p-6 lg:p-8">
        {!widgetKey ? (
          <Card>
            <CardTitle>Widget key not configured</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Generate a widget key in Settings to enable embeds and preview."
                : "Ask an admin to configure the widget key in Settings."}
            </CardDescription>
            {isAdmin ? (
              <Link href="/settings" className={buttonClassName({ className: "mt-4" })}>
                Open settings
              </Link>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Contact your workspace admin to enable the embeddable widget.
              </p>
            )}
          </Card>
        ) : !widgetEnabled ? (
          <Card>
            <CardTitle>Widget disabled</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Enable the widget in Settings to preview and embed it on customer sites."
                : "Ask an admin to enable the widget in Settings."}
            </CardDescription>
            {isAdmin ? (
              <Link href="/settings" className={buttonClassName({ className: "mt-4" })}>
                Open settings
              </Link>
            ) : null}
          </Card>
        ) : (
          <>
            {!hasAppUrl ? (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                APP_URL is not set. Embed snippets use a localhost fallback and will
                not work on customer sites until you configure APP_URL.
              </div>
            ) : null}

            <div className="mb-6 rounded-2xl border border-primary/15 bg-primary-soft/50 px-4 py-3 text-sm text-primary">
              Click the bubble in the bottom-right corner to preview the floating widget.
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <Card className="min-h-[420px]">
                <p className="text-sm font-semibold text-slate-900">Live preview area</p>
                <p className="mt-2 text-sm text-slate-500">
                  This simulates a customer site. The widget floats above your product UI.
                </p>
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  Customer-facing content appears here
                </div>
              </Card>

              <div className="space-y-4">
                <Card id="iframe-embed">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Code2 className="h-4 w-4 text-primary" />
                    Recommended launcher script
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Paste before the closing body tag. The launcher starts as a
                    small corner iframe and grows when the chat opens so the rest
                    of the host page stays clickable.
                  </p>
                  <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{launcherScript}
                  </pre>
                  <EmbedSnippetCopy label="Copy launcher script" text={launcherScript ?? ""} />
                </Card>

                <Card>
                  <p className="text-sm font-semibold text-slate-900">Iframe only</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Full-viewport iframe with pointer-events enabled. Use the
                    launcher script above for the simplest install.
                  </p>
                  <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{iframeMarkup}
                  </pre>
                  <EmbedSnippetCopy label="Copy iframe markup" text={iframeMarkup ?? ""} />
                </Card>
              </div>
            </div>

            <FloatingWidget
              hasDocuments={hasDocuments}
              welcomeMessage={settings.greeting}
              widgetKey={widgetKey}
              organizationName={organization.name}
            />
          </>
        )}
      </main>
    </>
  );
}
