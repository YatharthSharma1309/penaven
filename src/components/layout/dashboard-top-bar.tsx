"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { BrandLogo } from "@/components/layout/brand-logo";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { MobileMenuButton } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { clerkAppearance } from "@/lib/clerk-appearance";
import type { MemberRole } from "@/generated/prisma/client";

function isDemoToolsEnabled() {
  const publicDemo =
    process.env.NEXT_PUBLIC_PUBLIC_DEMO_MODE === "true" &&
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

  return (
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true" &&
    (process.env.NODE_ENV !== "production" || publicDemo)
  );
}

type DashboardTopBarProps = {
  mobileNavOpen: boolean;
  onMobileNavToggle: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  role?: MemberRole;
};

export function DashboardTopBar({
  mobileNavOpen,
  onMobileNavToggle,
  menuButtonRef,
  role = "AGENT",
}: DashboardTopBarProps) {
  const demoMode = isDemoToolsEnabled();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-r border-border pr-4 sm:pr-5">
          <MobileMenuButton
            ref={menuButtonRef}
            open={mobileNavOpen}
            controlsId="mobile-nav-menu"
            onClick={onMobileNavToggle}
            className="md:hidden"
          />
          <BrandLogo href="/dashboard" size="sm" collapseWordmark />
        </div>

        <DashboardNav role={role} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-border pl-3 sm:gap-2 sm:pl-4">
          <ThemeToggle className="h-8 w-8 rounded-lg border-0 bg-transparent shadow-none hover:bg-foreground/[0.05]" />
          {demoMode ? null : (
            <>
              <OrganizationSwitcher
                hidePersonal
                appearance={{
                  ...clerkAppearance,
                  elements: {
                    ...clerkAppearance.elements,
                    organizationSwitcherTrigger:
                      "h-8 rounded-lg border border-border px-2.5 text-sm",
                  },
                }}
              />
              <UserButton appearance={clerkAppearance} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export type { MemberRole };
