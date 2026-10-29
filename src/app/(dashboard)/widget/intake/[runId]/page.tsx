import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ExecutionLogTable } from "@/components/execution/execution-log-table";
import { ExecutionRunStoryboard } from "@/components/execution/execution-run-storyboard";
import { WidgetIntakeRunSelector } from "@/components/execution/widget-intake-run-selector";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function WidgetIntakeRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { organization } = await requireOrgMembershipOrRedirect();
  const { runId } = await params;

  const run = await db.executionRun.findFirst({
    where: { id: runId, workspaceId: organization.id },
  });

  if (!run) {
    notFound();
  }

  const [runs, logs, conversation, linkedTicket] = await Promise.all([
    db.executionRun.findMany({
      where: { workspaceId: organization.id, trigger: "widget_intake" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        conversationId: true,
      },
    }),
    db.executionLogEntry.findMany({
      where: { runId: run.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        workspaceId: true,
        agent: true,
        trigger: true,
        model: true,
        decision: true,
        latencyMs: true,
        metadata: true,
      },
    }),
    run.conversationId
      ? db.conversation.findFirst({
          where: {
            id: run.conversationId,
            organizationId: organization.id,
          },
          select: { id: true, channel: true },
        })
      : Promise.resolve(null),
    run.conversationId
      ? db.ticket.findFirst({
          where: {
            organizationId: organization.id,
            conversationId: run.conversationId,
            title: { startsWith: "Escalation:" },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <Header
        title="Run log"
        description="What was retrieved, and whether this reply came from the docs or went to a person."
        action={
          <Link href="/widget/intake" className={buttonClassName({ size: "sm", variant: "secondary" })}>
            Back
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <Card className="p-6">
            <WidgetIntakeRunSelector runs={runs} selectedRunId={run.id} />
          </Card>

          <Card className="p-6">
            <ExecutionRunStoryboard
              logs={logs}
              conversationId={run.conversationId}
              conversationChannel={conversation?.channel ?? run.channel}
              ticketId={linkedTicket?.id ?? null}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">Raw execution log</p>
              <p className="font-mono text-xs text-slate-500">
                conversationId: {run.conversationId ?? "N/A"} · channel: {run.channel}
              </p>
            </div>

            <ExecutionLogTable logs={logs} />
          </Card>
        </div>
      </main>
    </>
  );
}
