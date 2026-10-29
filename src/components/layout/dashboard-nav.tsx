"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  appPrimaryNav,
  filterNavByRole,
  isNavActive,
} from "@/components/layout/app-nav";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/generated/prisma/client";

type DashboardNavProps = {
  role?: MemberRole;
  className?: string;
};

function navLinkClass(active: boolean) {
  return cn(
    "relative inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active
      ? "bg-primary-soft text-primary"
      : "text-muted hover:bg-foreground/[0.05] hover:text-foreground",
  );
}

export function DashboardNav({
  role = "AGENT",
  className,
}: DashboardNavProps) {
  const pathname = usePathname();
  const primary = filterNavByRole(appPrimaryNav, role);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "hidden min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto pl-1 md:flex sm:pl-2",
        className,
      )}
    >
      {primary.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              navLinkClass(active),
              item.separate && "ml-1 border-l border-border pl-3",
            )}
          >
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
