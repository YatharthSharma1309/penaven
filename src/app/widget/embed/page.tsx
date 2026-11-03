import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { FloatingWidget } from "@/components/widget/floating-widget";
import { resolveWidgetOrganization } from "@/lib/auth/widget";
import { db } from "@/lib/db";
import { getAgentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type WidgetEmbedPageProps = {
  searchParams: Promise<{ key?: string; channel?: string }>;
};

function parseWidgetChannel(
  channel?: string,
): "WIDGET" | "HELP_CENTER" {
  const normalized = channel?.toUpperCase();
  if (normalized === "HELP_CENTER" || normalized === "HELP") {
    return "HELP_CENTER";
  }
  return "WIDGET";
}

export default async function WidgetEmbedPage({
  searchParams,
}: WidgetEmbedPageProps) {
  const { key, channel: channelParam } = await searchParams;
  const widgetChannel = parseWidgetChannel(channelParam);

  if (!key) {
    notFound();
  }

  const headerList = await headers();
  const requestHeaders = new Headers();
  const origin = headerList.get("origin");
  const referer = headerList.get("referer");
  const host = headerList.get("host");

  if (origin) {
    requestHeaders.set("origin", origin);
  } else if (referer) {
    requestHeaders.set("referer", referer);
  } else if (host) {
    const appUrl = process.env.APP_URL ?? `http://${host}`;
    try {
      requestHeaders.set("origin", new URL(appUrl).origin);
    } catch {
      requestHeaders.set("origin", `http://${host}`);
    }
  }

  let organization;
  try {
    organization = await resolveWidgetOrganization(key, {
      headers: requestHeaders,
    } as Request);
  } catch {
    notFound();
  }

  const [readyDocuments, settings] = await Promise.all([
    db.document.count({
      where: { organizationId: organization.id, status: "READY" },
    }),
    getAgentSettings(organization.id),
  ]);
  const hasDocuments = readyDocuments > 0;

  return (
    <div className="pointer-events-none fixed inset-0 bg-transparent">
      <FloatingWidget
        hasDocuments={hasDocuments}
        welcomeMessage={settings.greeting}
        widgetKey={key}
        widgetChannel={widgetChannel}
      />
    </div>
  );
}
