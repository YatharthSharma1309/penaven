"use client";

import Link from "next/link";
import { OpsConciergeLogoMark } from "@/components/layout/relay-logo-mark";
import { companyTagline } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  showTagline?: boolean;
  size?: "sm" | "md";
  /** Light surfaces (default) or dark footer bands */
  tone?: "light" | "dark";
  /** Hide the Penaven text (mark only) */
  showWordmark?: boolean;
  /** Hide wordmark until wide screens — keeps app navbar from crowding */
  collapseWordmark?: boolean;
  className?: string;
  onNavigate?: () => void;
};

export function BrandLogo({
  href = "/",
  showTagline = false,
  size = "md",
  tone = "light",
  showWordmark = true,
  collapseWordmark = false,
  className,
  onNavigate,
}: BrandLogoProps) {
  const markSize = size === "sm" ? 30 : 40;
  const dark = tone === "dark";

  const content = (
    <div className={cn("flex min-w-0 items-center gap-2.5 sm:gap-3", className)}>
      <OpsConciergeLogoMark
        size={markSize}
        className={cn(
          "rounded-[10px] transition-[transform,box-shadow] duration-200 ease-out",
          "group-hover:scale-[1.03]",
          dark
            ? "shadow-md shadow-black/30 ring-1 ring-white/15"
            : "shadow-md shadow-slate-900/15 ring-1 ring-slate-900/10 dark:shadow-black/40 dark:ring-white/10",
        )}
      />
      {showWordmark ? (
        <div
          className={cn(
            "min-w-0 leading-tight",
            collapseWordmark && "hidden min-[1180px]:block",
          )}
        >
          <p
            className={cn(
              "truncate font-semibold tracking-[-0.02em] transition-colors duration-200",
              dark ? "text-white" : "text-foreground",
              size === "sm" ? "text-[15px]" : "text-[17px]",
            )}
          >
            Penaven
          </p>
          {showTagline ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[11px] font-medium tracking-[0.02em]",
                dark ? "text-slate-400" : "text-muted",
              )}
            >
              {companyTagline}
            </p>
          ) : null}
        </div>
      ) : null}
      {(!showWordmark || collapseWordmark) && (
        <span className="sr-only">Penaven</span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "group inline-flex max-w-full rounded-xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2",
          dark
            ? "focus-visible:ring-teal-500/50 focus-visible:ring-offset-slate-950"
            : "focus-visible:ring-teal-600/40 focus-visible:ring-offset-background",
        )}
      >
        {content}
      </Link>
    );
  }

  return content;
}
