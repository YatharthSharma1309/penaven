import * as conversation from "@/app/api/conversations/[id]/route";
import * as document from "@/app/api/documents/[id]/route";
import * as messageFeedback from "@/app/api/messages/[id]/feedback/route";
import * as candidateFile from "@/app/api/recruitment/candidates/[id]/file/route";
import * as candidate from "@/app/api/recruitment/candidates/[id]/route";
import * as jobExport from "@/app/api/recruitment/jobs/[id]/export/route";
import * as hireFinalize from "@/app/api/recruitment/jobs/[id]/hire/finalize/route";
import * as hireUndo from "@/app/api/recruitment/jobs/[id]/hire/undo/route";
import * as job from "@/app/api/recruitment/jobs/[id]/route";
import * as jobShare from "@/app/api/recruitment/jobs/[id]/share/route";
import * as ticketComments from "@/app/api/tickets/[id]/comments/route";
import * as ticket from "@/app/api/tickets/[id]/route";
import * as suggestReply from "@/app/api/tickets/[id]/suggest-reply/route";
import * as widgetFeedback from "@/app/api/widget/messages/[id]/feedback/route";
import type { RouteContext } from "./http";
import type { Tenant } from "./seed";

type Handler = (request: Request, context: RouteContext) => Promise<Response>;

/**
 * Every route with an `[id]`, by path under src/app/api. A new route file fails
 * route-coverage.test.ts until it is added here and given a case below.
 */
export const ID_ROUTE_MODULES: Record<string, object> = {
  "conversations/[id]/route.ts": conversation,
  "documents/[id]/route.ts": document,
  "messages/[id]/feedback/route.ts": messageFeedback,
  "recruitment/candidates/[id]/file/route.ts": candidateFile,
  "recruitment/candidates/[id]/route.ts": candidate,
  "recruitment/jobs/[id]/export/route.ts": jobExport,
  "recruitment/jobs/[id]/hire/finalize/route.ts": hireFinalize,
  "recruitment/jobs/[id]/hire/undo/route.ts": hireUndo,
  "recruitment/jobs/[id]/route.ts": job,
  "recruitment/jobs/[id]/share/route.ts": jobShare,
  "tickets/[id]/comments/route.ts": ticketComments,
  "tickets/[id]/route.ts": ticket,
  "tickets/[id]/suggest-reply/route.ts": suggestReply,
  "widget/messages/[id]/feedback/route.ts": widgetFeedback,
};

export const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type IdRouteCase = {
  file: string;
  method: HttpMethod;
  /** Tells apart two cases on one route. */
  note?: string;
  /** The record the `[id]` names, in the workspace that owns it. */
  target: (owner: Tenant) => string;
  /** A valid body, so a denial cannot be a validation error. */
  body?: unknown;
  /** Widget routes are called with the caller's key and visitor token. */
  widget?: boolean;
  /** What the owner gets for the same request, which proves the case reaches the check. */
  ownerStatus: number;
  /** The owner sees their own canary, for routes that return the record. */
  ownerSees?: boolean;
};

export const ID_ROUTE_CASES: IdRouteCase[] = [
  {
    file: "conversations/[id]/route.ts",
    method: "GET",
    target: (owner) => owner.conversation.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "conversations/[id]/route.ts",
    method: "GET",
    note: "widget conversation",
    target: (owner) => owner.widgetConversation.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "documents/[id]/route.ts",
    method: "DELETE",
    target: (owner) => owner.document.id,
    ownerStatus: 200,
  },
  {
    file: "messages/[id]/feedback/route.ts",
    method: "POST",
    target: (owner) => owner.message.id,
    body: { helpful: false },
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "recruitment/candidates/[id]/file/route.ts",
    method: "GET",
    target: (owner) => owner.candidate.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "recruitment/candidates/[id]/route.ts",
    method: "GET",
    target: (owner) => owner.candidate.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "recruitment/candidates/[id]/route.ts",
    method: "PATCH",
    target: (owner) => owner.candidate.id,
    body: { notes: "Rewritten by another workspace" },
    ownerStatus: 200,
  },
  {
    file: "recruitment/candidates/[id]/route.ts",
    method: "PATCH",
    note: "backing out a pending hire",
    target: (owner) => owner.hired.id,
    body: { status: "rejected" },
    ownerStatus: 200,
  },
  {
    file: "recruitment/candidates/[id]/route.ts",
    method: "PATCH",
    note: "hiring over a pending hire",
    target: (owner) => owner.candidate.id,
    body: { status: "hired" },
    ownerStatus: 409,
  },
  {
    file: "recruitment/candidates/[id]/route.ts",
    method: "DELETE",
    target: (owner) => owner.candidate.id,
    ownerStatus: 200,
  },
  {
    file: "recruitment/jobs/[id]/export/route.ts",
    method: "GET",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "recruitment/jobs/[id]/hire/finalize/route.ts",
    method: "POST",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
  },
  {
    file: "recruitment/jobs/[id]/hire/undo/route.ts",
    method: "POST",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
  },
  {
    file: "recruitment/jobs/[id]/route.ts",
    method: "GET",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "recruitment/jobs/[id]/route.ts",
    method: "PATCH",
    target: (owner) => owner.job.id,
    body: {
      title: "Rewritten by another workspace",
      description: "A replacement description long enough to pass validation.",
      requiredSkills: ["Rewriting"],
    },
    ownerStatus: 200,
  },
  {
    file: "recruitment/jobs/[id]/route.ts",
    method: "DELETE",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
  },
  {
    file: "recruitment/jobs/[id]/share/route.ts",
    method: "POST",
    target: (owner) => owner.job.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "tickets/[id]/comments/route.ts",
    method: "POST",
    target: (owner) => owner.ticket.id,
    body: { content: "Written by another workspace" },
    ownerStatus: 200,
  },
  {
    file: "tickets/[id]/route.ts",
    method: "GET",
    target: (owner) => owner.ticket.id,
    ownerStatus: 200,
    ownerSees: true,
  },
  {
    file: "tickets/[id]/route.ts",
    method: "PATCH",
    target: (owner) => owner.ticket.id,
    body: { status: "RESOLVED" },
    ownerStatus: 200,
  },
  {
    file: "tickets/[id]/suggest-reply/route.ts",
    method: "POST",
    target: (owner) => owner.ticket.id,
    ownerStatus: 200,
  },
  {
    file: "widget/messages/[id]/feedback/route.ts",
    method: "POST",
    target: (owner) => owner.widgetMessage.id,
    body: { helpful: false },
    widget: true,
    ownerStatus: 200,
    ownerSees: true,
  },
];

export function handlerFor(routeCase: IdRouteCase): Handler {
  const routeModule = ID_ROUTE_MODULES[routeCase.file] as Record<string, Handler>;
  return routeModule[routeCase.method];
}

/** The URL Next would have routed here, for the Request the handler reads. */
export function pathFor(routeCase: IdRouteCase, id: string) {
  return `/api/${routeCase.file.replace("/route.ts", "").replace("[id]", id)}`;
}
