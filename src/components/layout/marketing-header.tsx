import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MarketingHeaderShell } from "@/components/layout/marketing-header-shell";
import { MarketingAuthLinks, MarketingNav } from "@/components/layout/marketing-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingHeaderProps = {
  variant?: "marketing" | "help" | "app";
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  className?: string;
};

export function MarketingHeader({
  variant = "marketing",
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  action,
  className,
}: MarketingHeaderProps) {
  return (
    <MarketingHeaderShell className={className}>
      <div
        className={cn(
          "mx-auto flex gap-3 px-4 py-3 sm:px-6",
          variant === "marketing"
            ? "items-center justify-between"
            : "flex-col sm:flex-row sm:items-center sm:justify-between",
          variant === "marketing" ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        {variant === "marketing" ? (
          <>
            <BrandLogo showTagline />
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <MarketingNav />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label={backLabel}
                  className={buttonClassName({
                    variant: "ghost",
                    size: "sm",
                    className: "min-h-11 shrink-0",
                  })}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </Link>
              ) : null}
              <BrandLogo href="/" size="sm" className="hidden shrink-0 sm:flex" />
              {title ? (
                <div className="min-w-0 border-l border-border pl-3 sm:pl-4">
                  <h1 className="text-base font-semibold text-foreground sm:truncate sm:text-lg">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="text-xs leading-5 text-muted sm:truncate sm:text-sm">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {variant === "help" ? (
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                <MarketingAuthLinks className="shrink-0" />
              </div>
            ) : action ? (
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                {action}
              </div>
            ) : (
              <ThemeToggle />
            )}
          </>
        )}
      </div>
    </MarketingHeaderShell>
  );
}
