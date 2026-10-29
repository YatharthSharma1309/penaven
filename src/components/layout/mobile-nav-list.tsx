"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  appAllNav,
  filterNavByRole,
  helpHrefForOrg,
  helpNavItem,
  isNavActive,
} from "@/components/layout/app-nav";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/generated/prisma/client";

type MobileNavListProps = {
  onNavigate?: () => void;
  className?: string;
  organizationSlug?: string;
  role?: MemberRole;
  showBrand?: boolean;
};

export function MobileNavList({
  onNavigate,
  className,
  organizationSlug,
  role = "AGENT",
  showBrand = true,
}: MobileNavListProps) {
  const pathname = usePathname();
  const items = filterNavByRole(appAllNav, role);
  const helpHref = helpHrefForOrg(organizationSlug);
  const HelpIcon = helpNavItem.icon;

  return (
    <div className={cn("flex h-full flex-col bg-surface", className)}>
      {showBrand ? (
        <div className="border-b border-border px-4 py-4">
          <BrandLogo
            href="/dashboard"
            showTagline
            onNavigate={onNavigate}
          />
        </div>
      ) : null}

      <nav
        className={cn(
          "flex-1 overflow-y-auto px-2 py-4",
          !showBrand && "pt-2",
        )}
        aria-label="Main"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li
                key={item.href}
                className={item.separate ? "mt-3 border-t border-border pt-3" : undefined}
              >
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:bg-foreground/[0.05] hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-medium">{item.label}</span>
                    {item.description ? (
                      <span
                        className={cn(
                          "mt-0.5 block text-[11px] font-normal",
                          active ? "text-primary/70" : "text-muted",
                        )}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-2 py-3">
        <Link
          href={helpHref}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/help")
              ? "bg-primary-soft text-primary"
              : "text-muted hover:bg-foreground/[0.05] hover:text-foreground",
          )}
        >
          <HelpIcon
            className={cn(
              "h-4 w-4 shrink-0",
              pathname.startsWith("/help") ? "text-primary" : undefined,
            )}
            aria-hidden
          />
          Help center
        </Link>
      </div>
    </div>
  );
}
