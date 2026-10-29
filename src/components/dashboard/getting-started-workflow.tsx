"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  MessageSquare,
  Ticket,
} from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { hiringWorkspaceHref } from "@/lib/env/public-demo";

const steps = [
  {
    step: "01",
    title: "Upload the docs",
    description: "Add the FAQ or policy customers should be answered from.",
    href: "/knowledge",
    icon: BookOpen,
    color: "text-primary bg-primary-soft",
  },
  {
    step: "02",
    title: "Read the cited answer",
    description: "Ask from the site chat and open the passage under the reply.",
    href: "/widget",
    icon: MessageSquare,
    color: "text-primary bg-primary-soft",
  },
  {
    step: "03",
    title: "Hand it to a person",
    description:
      "When the docs do not cover it, hand the case to a person. The inbox then marks it Waiting for a human.",
    href: "/inbox",
    icon: Ticket,
    color: "text-primary bg-primary-soft",
  },
  {
    step: "04",
    title: "Compare the lines",
    description:
      "When a role opens, read Shown and Not shown. You decide.",
    href: hiringWorkspaceHref(),
    icon: Briefcase,
    color: "text-accent bg-accent-soft",
  },
];

export function GettingStartedWorkflow() {
  return (
    <Card>
      <CardTitle>Walk the desk</CardTitle>
      <CardDescription>
        The docs, a cited answer, a person when it is not covered, and a
        shortlist when a role opens.
      </CardDescription>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.step}
              href={item.href}
              className="group rounded-xl border border-border p-4 transition-all hover:border-accent/40 hover:bg-accent-soft/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Step {item.step}
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className={`mt-3 inline-flex rounded-xl p-2.5 ${item.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {item.description}
              </p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
