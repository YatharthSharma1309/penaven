import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ExecutionLogTable } from "@/components/execution/execution-log-table";
import { ExecutionRunStoryboard } from "@/components/execution/execution-run-storyboard";
import { WidgetIntakeRunSelector } from "@/components/execution/widget-intake-run-selector";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { db } from "@/lib/db";
import { Inbox } from "lucide-react";

export default async function WidgetIntakePage() {
  const { organization } = await requireOrgMembershipOrRedirect();

  const runs = await db.executionRun.findMany({
    where: { workspaceId: organization.id, trigger: "widget_intake" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      conversationId: true,
      channel: true,
    },
  });

  const latestRun = runs[0] ?? null;

  const logs = latestRun
    ? await db.executionLogEntry.findMany({
        where: { runId: latestRun.id },
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
      })
    : [];

  const linkedTicket =
    latestRun?.conversationId
      ? await db.ticket.findFirst({
          where: {
            organizationId: organization.id,
            conversationId: latestRun.conversationId,
            title: { startsWith: "Escalation:" },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;

  return (
    <>
      <Header
        title="Run log"
        description="What the assistant retrieved, and whether the reply came from the docs or went to a person."
        action={
          latestRun ? (
            <Link
              href={`/widget/intake/${latestRun.id}`}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Open full storyboard
            </Link>
          ) : null
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {runs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No widget runs yet"
            description="Send a message from the site chat. Each run shows up here."
            action={
              <Link href="/widget" className={buttonClassName({ size: "sm" })}>
                Preview widget
              </Link>
            }
            className="py-8"
          />
        ) : (
          <div className="space-y-6">
            <Card className="p-6">
              <WidgetIntakeRunSelector
                runs={runs}
                selectedRunId={latestRun!.id}
              />
            </Card>

            <Card className="p-6">
              <ExecutionRunStoryboard
                logs={logs}
                conversationId={latestRun!.conversationId}
                conversationChannel={latestRun!.channel}
                ticketId={linkedTicket?.id ?? null}
                compact
              />
            </Card>

            <Card className="p-6">
              <ExecutionLogTable logs={logs} />
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
