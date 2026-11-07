import { Card, CardTitle } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  describeAuditEvent,
  type AuditEventDTO,
} from "@/lib/recruitment/services/audit";

type JobActivityLogProps = {
  events: AuditEventDTO[];
};

export function JobActivityLog({ events }: JobActivityLogProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardTitle>Activity log</CardTitle>
      <ul className="mt-4 space-y-3">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0"
          >
            <span className="text-slate-700">{describeAuditEvent(event)}</span>
            <RelativeTime date={event.createdAt} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
