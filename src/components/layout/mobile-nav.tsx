"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MobileNavList } from "@/components/layout/mobile-nav-list";
import { ClientPortal } from "@/components/ui/client-portal";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  organizationSlug?: string;
  role?: import("@/generated/prisma/client").MemberRole;
};

export function MobileNavDrawer({
  open,
  onOpenChange,
  returnFocusRef,
  organizationSlug,
  role,
}: MobileNavProps) {
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
      returnFocusRef?.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open, returnFocusRef]);

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
        onOpenChange(false);
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
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <ClientPortal>
      <button
        type="button"
        className="fixed inset-0 z-[100] bg-slate-900/40 md:hidden"
        aria-label="Close navigation overlay"
        onClick={() => onOpenChange(false)}
      />
      <aside
        ref={drawerRef}
        id="mobile-nav-menu"
        className={cn(
          "mobile-drawer-panel-left fixed inset-y-0 left-0 z-[101] flex w-[min(18rem,100vw)] flex-col border-r border-border bg-surface shadow-2xl md:hidden",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <BrandLogo
            href="/dashboard"
            size="sm"
            showTagline
            onNavigate={() => onOpenChange(false)}
          />
          <MobileMenuButton
            open={open}
            controlsId="mobile-nav-menu"
            onClick={() => onOpenChange(false)}
          />
        </div>
        <MobileNavList
          className="min-h-0 flex-1"
          showBrand={false}
          onNavigate={() => onOpenChange(false)}
          organizationSlug={organizationSlug}
          role={role}
        />
      </aside>
    </ClientPortal>
  );
}

export const MobileMenuButton = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    onClick: () => void;
    controlsId?: string;
    className?: string;
  }
>(function MobileMenuButton({ open, onClick, controlsId, className }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-border p-2 text-muted transition-[color,background-color,border-color,box-shadow] duration-200 hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onClick}
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
});
