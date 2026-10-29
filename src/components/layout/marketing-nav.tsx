"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MobileMenuButton } from "@/components/layout/mobile-nav";
import { ClientPortal } from "@/components/ui/client-portal";
import { buttonClassName } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/env/clerk";
import { isMarketingDemoMode } from "@/lib/env/marketing-demo";
import { cn } from "@/lib/utils";

function marketingNavLinkClass({
  variant = "ghost",
  column = false,
}: {
  variant?: "primary" | "ghost";
  column?: boolean;
}) {
  if (!column) {
    return buttonClassName({
      variant: variant === "primary" ? "primary" : "ghost",
      size: "sm",
      className: "min-h-11",
    });
  }

  return cn(
    buttonClassName({
      variant: variant === "primary" ? "primary" : "ghost",
      size: "sm",
    }),
    "min-h-11 w-full justify-start",
    variant === "primary" && "mt-2",
  );
}

type MarketingNavLinksProps = {
  onNavigate?: () => void;
  className?: string;
  layout?: "row" | "column";
};

function MarketingNavLinksBypass({
  onNavigate,
  className,
  layout = "row",
}: MarketingNavLinksProps) {
  const isColumn = layout === "column";

  return (
    <div
      className={cn(
        isColumn ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2 sm:gap-3",
        className,
      )}
    >
      <Link
        href="/help"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Help center
      </Link>
      <Link
        href="/#how-it-works"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        How it works
      </Link>
      <Link
        href="/#try-demo"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Try the demo
      </Link>
      <Link
        href="/#who"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Who it&apos;s for
      </Link>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={marketingNavLinkClass({ variant: "primary", column: isColumn })}
      >
        Open live demo
      </Link>
    </div>
  );
}

function MarketingNavLinksWithClerk({
  onNavigate,
  className,
  layout = "row",
}: MarketingNavLinksProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const isColumn = layout === "column";

  return (
    <div
      className={cn(
        isColumn ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2 sm:gap-3",
        className,
      )}
    >
      <Link
        href="/help"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Help center
      </Link>
      <Link
        href="/#how-it-works"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        How it works
      </Link>
      <Link
        href="/#try-demo"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Try the demo
      </Link>
      <Link
        href="/#who"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Who it&apos;s for
      </Link>
      {isLoaded && isSignedIn ? (
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={marketingNavLinkClass({ variant: "primary", column: isColumn })}
        >
          Open live demo
        </Link>
      ) : (
        <>
          <Link
            href="/sign-in"
            onClick={onNavigate}
            className={marketingNavLinkClass({ column: isColumn })}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={onNavigate}
            className={marketingNavLinkClass({ variant: "primary", column: isColumn })}
          >
            Get started free
          </Link>
        </>
      )}
    </div>
  );
}

function MarketingNavLinks(props: MarketingNavLinksProps) {
  if (isMarketingDemoMode()) {
    return <MarketingNavLinksBypass {...props} />;
  }

  if (!isClerkConfigured()) {
    return <MarketingNavLinksPublic {...props} />;
  }

  return <MarketingNavLinksWithClerk {...props} />;
}

function MarketingNavLinksPublic({
  onNavigate,
  className,
  layout = "row",
}: MarketingNavLinksProps) {
  const isColumn = layout === "column";

  return (
    <div
      className={cn(
        isColumn ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2 sm:gap-3",
        className,
      )}
    >
      <Link
        href="/help"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Help center
      </Link>
      <Link
        href="/#how-it-works"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        How it works
      </Link>
      <Link
        href="/#try-demo"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Try the demo
      </Link>
      <Link
        href="/#who"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Who it&apos;s for
      </Link>
      <Link
        href="/sign-in"
        onClick={onNavigate}
        className={marketingNavLinkClass({ column: isColumn })}
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        onClick={onNavigate}
        className={marketingNavLinkClass({ variant: "primary", column: isColumn })}
      >
        Get started free
      </Link>
    </div>
  );
}

export function MarketingAuthLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  if (isMarketingDemoMode()) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={buttonClassName({ size: "sm" })}
        >
          Open live demo
        </Link>
      </div>
    );
  }

  if (!isClerkConfigured()) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Link
          href="/sign-in"
          onClick={onNavigate}
          className={buttonClassName({ variant: "ghost", size: "sm" })}
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          onClick={onNavigate}
          className={buttonClassName({ size: "sm" })}
        >
          Get started free
        </Link>
      </div>
    );
  }

  return <MarketingAuthLinksWithClerk onNavigate={onNavigate} className={className} />;
}

function MarketingAuthLinksWithClerk({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {isLoaded && isSignedIn ? (
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={buttonClassName({ size: "sm" })}
        >
          Open live demo
        </Link>
      ) : (
        <>
          <Link
            href="/sign-in"
            onClick={onNavigate}
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={onNavigate}
            className={buttonClassName({ size: "sm" })}
          >
            Get started free
          </Link>
        </>
      )}
    </div>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      menuButtonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !focusable?.length) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <nav className="hidden items-center md:flex">
        <MarketingNavLinks />
      </nav>

      <div className="md:hidden">
        <MobileMenuButton
          ref={menuButtonRef}
          open={open}
          controlsId="marketing-nav-menu"
          onClick={() => setOpen((value) => !value)}
        />
      </div>

      {open ? (
        <ClientPortal>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-slate-900/40 md:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={drawerRef}
            id="marketing-nav-menu"
            className="mobile-drawer-panel fixed inset-y-0 right-0 z-[101] flex w-[min(18rem,100vw)] flex-col border-l border-border bg-surface shadow-2xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <BrandLogo
                href="/"
                size="sm"
                onNavigate={() => setOpen(false)}
              />
              <MobileMenuButton
                open={open}
                controlsId="marketing-nav-menu"
                onClick={() => setOpen(false)}
              />
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <MarketingNavLinks
                layout="column"
                onNavigate={() => setOpen(false)}
              />
            </nav>
          </aside>
        </ClientPortal>
      ) : null}
    </>
  );
}
