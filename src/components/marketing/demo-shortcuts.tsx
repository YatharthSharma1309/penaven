import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Home,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import {
  demoModuleLinks,
  type DemoModuleIcon,
} from "@/lib/env/marketing-demo";
import { cn } from "@/lib/utils";

const iconMap: Record<DemoModuleIcon, LucideIcon> = {
  dashboard: Home,
  widget: MessageSquare,
  hiring: Briefcase,
  analytics: BarChart3,
};

type DemoShortcutsProps = {
  /** Hero: quiet inline row. Footer: structured shortcut strip. */
  tone?: "light" | "dark";
  className?: string;
};

export function DemoShortcuts({
  tone = "light",
  className,
}: DemoShortcutsProps) {
  const isDark = tone === "dark";

  if (!isDark) {
    return (
      <nav aria-label="Demo shortcuts" className={cn(className)}>
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {demoModuleLinks.map((item, index) => (
            <li key={item.href} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="mx-1.5 h-3 w-px bg-slate-200" aria-hidden />
              ) : null}
              <Link
                href={item.href}
                className="rounded-md px-1.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Demo shortcuts" className={cn(className)}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {demoModuleLinks.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 transition-[border-color,background-color] duration-200 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-slate-400 ring-1 ring-slate-800 transition-colors group-hover:text-blue-300 group-hover:ring-blue-800/30">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-blue-300"
                    aria-hidden
                  />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-100">
                  {item.label}
                </span>
                <span className="mt-1 text-xs leading-5 text-slate-400 group-hover:text-slate-300">
                  {item.hint}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
