import Link from "next/link";
import { Headphones } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { db } from "@/lib/db";
import { cutForList, LIST_LIMIT, listLimitNote } from "@/lib/list-limit";
import { priorityTone, statusTone } from "@/lib/tickets/constants";
import { RelativeTime } from "@/components/ui/relative-time";

export default async function TicketsPage() {
  const { organization } = await requireOrgMembershipOrRedirect();
  const where = { organizationId: organization.id };
  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIST_LIMIT,
    }),
    db.ticket.count({ where }),
  ]);
  const limitNote = listLimitNote(total, "tickets");

  return (
    <>
      <Header
        title="Tickets"
        description="Track, assign, and resolve customer support requests."
        action={
          <Link href="/tickets/new" className={buttonClassName({ size: "sm" })}>
            New ticket
          </Link>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 px-4 py-6 sm:p-6 lg:p-8">
        {tickets.length === 0 ? (
          <EmptyState
            icon={Headphones}
            title="No tickets yet"
            description="Create one here, or hand a conversation over from the site chat when the docs do not cover it."
            action={
              <Link href="/tickets/new" className={buttonClassName()}>
                Create ticket
              </Link>
            }
          />
        ) : (
          <Card>
            {limitNote ? (
              <p className="mb-3 text-sm text-muted">{limitNote}</p>
            ) : null}
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-border px-4 py-4 transition-colors hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{ticket.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {cutForList(ticket.description)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={priorityTone[ticket.priority]}>
                      {ticket.priority.toLowerCase()}
                    </Badge>
                    <Badge tone={statusTone[ticket.status]}>
                      {ticket.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    <span className="text-xs text-muted">
                      <RelativeTime date={ticket.createdAt} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
