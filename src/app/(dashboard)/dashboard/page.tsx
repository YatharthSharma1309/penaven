import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardList,
  Headphones,
  MessageSquare,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { SetupHealthCard } from "@/components/dashboard/setup-health-card";
import { GettingStartedWorkflow } from "@/components/dashboard/getting-started-workflow";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import {
  countAssistantAnswersThisMonth,
  countResumeScreensThisMonth,
  countRoles,
} from "@/lib/billing/usage";
import { PLANS, planForWorkspace } from "@/lib/billing/plans";
import { hiringWorkspaceHref, isPublicDemoMode } from "@/lib/env/public-demo";
import { getWorkspaceHealth } from "@/lib/demo";
import { db } from "@/lib/db";
import { isAiConfigured, isEmbeddingEnabled } from "@/lib/ai";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils";

async function getDashboardData(organizationId: string) {
  const [health, documents, recentTickets] = await Promise.all([
    getWorkspaceHealth(organizationId),
    db.document.count({ where: { organizationId } }),
    db.ticket.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return { documents, ...health, recentTickets };
}

export default async function DashboardPage() {
  const { organization } = await requireOrgMembershipOrRedirect();
  const data = await getDashboardData(organization.id);
  const publicDemo = isPublicDemoMode();
  const plan = planForWorkspace({ publicDemo });
  const [answersUsed, screensUsed, rolesUsed] = await Promise.all([
    countAssistantAnswersThisMonth(organization.id),
    countResumeScreensThisMonth(organization.id),
    countRoles(organization.id),
  ]);
  const aiConfigured = isAiConfigured();
  const embeddingEnabled = isEmbeddingEnabled();
  const engineMode = !data.readyDocuments
    ? "Setup"
    : aiConfigured
      ? "Ready"
      : "Keyword";
  const engineHint = !data.readyDocuments
    ? "Upload knowledge docs first"
    : aiConfigured
      ? "Answers come from your knowledge base"
      : "Answers come from your documents";
  const quickActions = [
    { href: "/inbox", label: "Open inbox", variant: "primary" as const },
    { href: "/knowledge", label: "Upload documents", variant: "secondary" as const },
    { href: "/widget", label: "Open widget", variant: "secondary" as const },
    { href: "/chat", label: "Ask a question", variant: "secondary" as const },
    { href: "/analytics", label: "Inbox board", variant: "secondary" as const },
    { href: "/analytics/hiring", label: "Hiring board", variant: "secondary" as const },
  ];
  const aiEngineRows = [
    {
      label: "Assistant",
      value: aiConfigured ? "Ready" : "Keyword answers",
      done: aiConfigured,
    },
    {
      label: "Retrieval",
      value: embeddingEnabled ? "Embeddings + keyword" : "Keyword (free)",
      done: true,
    },
    {
      label: "Knowledge ready",
      value:
        data.readyDocuments > 0
          ? `${data.readyDocuments} ready file${data.readyDocuments === 1 ? "" : "s"}`
          : "No ready docs yet",
      done: data.readyDocuments > 0,
    },
    {
      label: "Chat tested",
      value:
        data.conversations > 0
          ? `${data.conversations} conversation${data.conversations === 1 ? "" : "s"}`
          : "Not tested yet",
      done: data.conversations > 0,
    },
  ];

  return (
    <>
      <Header
        title="Overview"
        description={`Start here — support health for ${organization.name}.`}
        readyDocuments={data.readyDocuments}
        aiConfigured={aiConfigured}
        action={
          <Link href="/widget" className={buttonClassName({ size: "sm" })}>
            Try the widget
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {/* First-visit next step */}
        <section className="rounded-2xl border border-primary/15 bg-primary-soft/60 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Next step
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Ask on the site, then hand one thread to a person
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Ask a question in the widget. If the docs cover it, the answer
            names them. If not, hand the thread to a person and open the run.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/widget" className={buttonClassName()}>
              <MessageSquare className="h-4 w-4" />
              Open widget
            </Link>
            <Link
              href="/widget/intake"
              className={buttonClassName({ variant: "secondary" })}
            >
              <ClipboardList className="h-4 w-4" />
              Run log
            </Link>
            <Link
              href={hiringWorkspaceHref()}
              className={buttonClassName({ variant: "ghost" })}
            >
              Hiring lane
            </Link>
          </div>
        </section>

        <SetupHealthCard
          readyDocuments={data.readyDocuments}
          conversations={data.conversations}
          aiConfigured={aiConfigured}
          embeddingEnabled={embeddingEnabled}
        />

        {/* Compact queue summary — includes AI Engine mode from the original 4-up */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Open tickets",
              value: data.openTickets,
              href: "/tickets",
              icon: Headphones,
            },
            {
              label: "Knowledge docs",
              value: data.documents,
              href: "/knowledge",
              icon: BookOpen,
            },
            {
              label: "Conversations",
              value: data.conversations,
              href: "/inbox",
              icon: MessageSquare,
            },
            {
              label: "Answers",
              value: engineMode,
              href: "/chat",
              icon: Bot,
              hint: engineHint,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3.5 transition",
                  "hover:border-primary/25 hover:bg-primary-soft/40",
                )}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">{item.label}</p>
                  <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-foreground">
                    {item.value}
                  </p>
                  {"hint" in item && item.hint ? (
                    <p className="mt-1 truncate text-[11px] text-muted">
                      {item.hint}
                    </p>
                  ) : null}
                </div>
                <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden />
              </Link>
            );
          })}
        </section>

        <Card>
          <CardTitle>This month</CardTitle>
          <CardDescription>
            {plan
              ? `Free includes ${plan.assistantAnswersPerMonth} answers, ${plan.resumeScreensPerMonth} resume screens, and ${plan.roles} role. Pro is $${PLANS.pro.priceUsd}/mo for the higher caps. There is no fee per answer, and no fee when a person takes the thread.`
              : "This demo does not apply the monthly caps. A signed-in workspace starts on Free."}
          </CardDescription>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Answers",
                used: answersUsed,
                cap: plan?.assistantAnswersPerMonth ?? null,
              },
              {
                label: "Resume screens",
                used: screensUsed,
                cap: plan?.resumeScreensPerMonth ?? null,
              },
              {
                label: "Roles",
                used: rolesUsed,
                cap: plan?.roles ?? null,
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-medium text-muted">{item.label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {item.cap === null ? item.used : `${item.used} of ${item.cap}`}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <GettingStartedWorkflow />

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Recent tickets</CardTitle>
            <CardDescription>
              Latest cases. Open one to read the conversation.
            </CardDescription>
            <div className="mt-5">
              {data.recentTickets.length === 0 ? (
                <EmptyState
                  icon={Headphones}
                  title="No tickets yet"
                  description="Hand a case from the site chat, or create one here."
                  action={
                    <Link
                      href="/widget"
                      className={buttonClassName({ size: "sm" })}
                    >
                      Open widget
                    </Link>
                  }
                  className="py-8"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentTickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {ticket.title}
                          </p>
                          <p className="text-xs text-muted">
                            {ticket.status.replace("_", " ").toLowerCase()}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          <RelativeTime date={ticket.createdAt} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>This workspace</CardTitle>
                <CardDescription>
                  Jump into the inbox, the knowledge base, and the widget.
                </CardDescription>
              </div>
              <Badge tone={aiConfigured ? "success" : "warning"}>
                {engineMode}
              </Badge>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={buttonClassName({
                    variant:
                      action.variant === "primary" ? "primary" : "secondary",
                  })}
                >
                  {action.label}
                </Link>
              ))}
            </div>

            <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
              {aiEngineRows.map((row) => {
                const StatusIcon = row.done ? CheckCircle2 : Circle;
                return (
                  <li
                    key={row.label}
                    className="flex items-start gap-3 px-3.5 py-2.5"
                  >
                    <StatusIcon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        row.done ? "text-success" : "text-muted",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted">
                        {row.label}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                        {row.value}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

          </Card>
        </section>
      </main>
    </>
  );
}
