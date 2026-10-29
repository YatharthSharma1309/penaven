import {
  BarChart3,
  BookOpen,
  Briefcase,
  Bot,
  ClipboardList,
  Headphones,
  HelpCircle,
  Home,
  Inbox,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { MemberRole } from "@/generated/prisma/client";
import { hiringWorkspaceHref } from "@/lib/env/public-demo";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Shown in drawer/sidebar-style lists */
  description?: string;
  /** Visually separates a later lane, such as Hiring, from support. */
  separate?: boolean;
};

/** Primary links shown in the top navbar on desktop. Support leads; hiring is a separate lane. */
export const appPrimaryNav: AppNavItem[] = [
  { href: "/inbox", label: "Inbox", description: "Customer conversations", icon: Inbox },
  { href: "/tickets", label: "Tickets", description: "Cases handed to you", icon: Headphones },
  { href: "/knowledge", label: "Knowledge", description: "Docs the answers use", icon: BookOpen },
  { href: "/widget", label: "Widget", description: "Website chat", icon: MessageSquare },
  {
    href: hiringWorkspaceHref(),
    label: "Hiring",
    description: "When a role opens",
    icon: Briefcase,
    separate: true,
  },
];

/** Secondary links — app footer on desktop + full mobile drawer */
export const appSecondaryNav: AppNavItem[] = [
  { href: "/dashboard", label: "Home", description: "Start here", icon: Home },
  { href: "/analytics", label: "Boards", description: "Inbox and hiring", icon: BarChart3 },
  { href: "/widget/intake", label: "Run log", description: "What the assistant did", icon: ClipboardList },
  { href: "/chat", label: "Chat", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export const appAllNav: AppNavItem[] = [
  ...appPrimaryNav,
  ...appSecondaryNav,
];

export function filterNavByRole(
  items: AppNavItem[],
  role: MemberRole = "AGENT",
) {
  return items.filter((item) => role === "ADMIN" || !item.adminOnly);
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/widget") {
    return pathname === "/widget" || pathname.startsWith("/widget/embed");
  }
  if (href === "/widget/intake") {
    return pathname === "/widget/intake" || pathname.startsWith("/widget/intake/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function helpHrefForOrg(organizationSlug?: string) {
  return organizationSlug ? `/help/${organizationSlug}` : "/help";
}

export const helpNavItem: AppNavItem = {
  href: "/help",
  label: "Help",
  icon: HelpCircle,
};
