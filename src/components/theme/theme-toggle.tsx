"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-[color,background-color,border-color,box-shadow] duration-200",
        "hover:border-primary/30 hover:bg-primary-soft hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* CSS picks the icon from the .dark class the boot script sets before paint,
          so a system-dark visitor never sees the moon flash in before hydration. */}
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
