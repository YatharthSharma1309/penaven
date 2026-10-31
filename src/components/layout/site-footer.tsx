import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  appSecondaryNav,
  filterNavByRole,
  helpHrefForOrg,
  helpNavItem,
} from "@/components/layout/app-nav";
import { DemoShortcuts } from "@/components/marketing/demo-shortcuts";
import { buttonClassName } from "@/components/ui/button";
import { isMarketingDemoMode } from "@/lib/env/marketing-demo";
import { companyDescription, companyName, companyTagline } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/generated/prisma/client";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.586 2 12.253c0 4.53 2.865 8.367 6.839 9.72.5.095.683-.222.683-.486 0-.24-.009-.875-.014-1.717-2.782.62-3.369-1.375-3.369-1.375-.454-1.178-1.11-1.492-1.11-1.492-.908-.637.069-.624.069-.624 1.003.072 1.532 1.057 1.532 1.057.892 1.566 2.341 1.114 2.91.852.092-.662.35-1.114.636-1.37-2.22-.26-4.555-1.143-4.555-5.086 0-1.123.39-2.042 1.029-2.762-.103-.26-.446-1.31.098-2.73 0 0 .84-.276 2.75 1.054A9.36 9.36 0 0 1 12 6.84a9.36 9.36 0 0 1 2.504.346c1.909-1.33 2.748-1.054 2.748-1.054.546 1.42.203 2.47.1 2.73.64.72 1.028 1.64 1.028 2.762 0 3.953-2.338 4.823-4.566 5.078.359.317.679.943.679 1.902 0 1.372-.012 2.477-.012 2.814 0 .267.18.586.688.486A10.27 10.27 0 0 0 22 12.253C22 6.586 17.523 2 12 2Z" />
    </svg>
  );
}

type SiteFooterProps = {
  variant?: "full" | "minimal" | "app";
  className?: string;
  /** Used by app footer for role-gated secondary links */
  role?: MemberRole;
  organizationSlug?: string;
};

const productLinks = [
  { href: "/sign-up", label: "Get started free" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/help", label: "Help center" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

const solutionLinks = [
  { href: "/#who", label: "D2C & Shopify brands" },
  { href: "/#who", label: "Early SaaS teams" },
  { href: "/#who", label: "Clinics & local services" },
  { href: "/#who", label: "Tutoring & agencies" },
];

const resourceLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#try-demo", label: "Try the demo" },
  { href: "/#features", label: "Support + hiring lanes" },
  { href: "/#scope", label: "What’s included" },
];

const demoResourceLinks = [
  { href: "/#try-demo", label: "Try the demo" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#who", label: "Who it’s for" },
  { href: "/#scope", label: "What’s included" },
  { href: "/help", label: "Help center" },
];

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="footer-link text-sm">
      {children}
    </Link>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({
  variant = "full",
  className,
  role = "AGENT",
  organizationSlug,
}: SiteFooterProps) {
  const year = 2026;
  const demoMode = isMarketingDemoMode();
  const footerResourceLinks = demoMode ? demoResourceLinks : resourceLinks;
  const primaryCtaHref = demoMode ? "/dashboard" : "/sign-up";
  const secondaryCtaHref = demoMode ? "/widget" : "/help";

  if (variant === "app") {
    const secondary = filterNavByRole(appSecondaryNav, role);
    const helpHref = helpHrefForOrg(organizationSlug);
    const appLinks = [
      ...secondary.map((item) => ({ href: item.href, label: item.label })),
      { href: helpHref, label: helpNavItem.label },
    ];

    return (
      <footer
        className={cn(
          "shrink-0 border-t border-border bg-surface",
          className,
        )}
      >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted">
            © {year} {companyName} · {companyTagline}
          </p>
          <nav
            aria-label="Secondary"
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            {appLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-muted transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    );
  }

  if (variant === "minimal") {
    return (
      <footer
        className={cn(
          "border-t border-slate-800 bg-slate-950 py-5 text-slate-400",
          className,
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <BrandLogo href="/" size="sm" tone="dark" />
          <p className="text-sm text-slate-400">Support desk for small teams</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className={cn("bg-slate-950 text-slate-300", className)}>
      <div className="border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              Ready when you are
            </p>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Answers from your docs. A person when it isn’t.
            </h2>
            <p className="mt-3 text-pretty text-sm leading-6 text-slate-400">
              Website chat cites the file. The rest of the thread goes to a
              person. The shortlist is there when a role opens.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={primaryCtaHref}
              className={cn(
                buttonClassName({ size: "lg" }),
                "group interact-lift focus-visible:!ring-offset-slate-950",
              )}
            >
              {demoMode ? "Open live demo" : "Get started free"}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={secondaryCtaHref}
              className={cn(
                buttonClassName({ variant: "secondary", size: "lg" }),
                "interact-lift !border-slate-700 !bg-slate-900 text-slate-100 hover:!border-slate-600 hover:!bg-slate-800 focus-visible:!ring-offset-slate-950",
              )}
            >
              {demoMode ? "Support widget" : "Help center"}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {demoMode ? (
          <div className="mb-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Jump into the demo
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Four paths that show the full product story.
                </p>
              </div>
            </div>
            <DemoShortcuts tone="dark" className="mt-6" />
          </div>
        ) : null}

        <div
          className={cn(
            "grid gap-12",
            demoMode
              ? "border-t border-slate-800 pt-12 lg:grid-cols-[1.6fr_1fr_1fr]"
              : "lg:grid-cols-[1.4fr_repeat(3,1fr)]",
          )}
        >
          <div>
            <BrandLogo showTagline tone="dark" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              {companyDescription}
            </p>

            <a
              href="https://github.com/YatharthSharma1309/penaven"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link mt-7 inline-flex items-center gap-2 text-sm"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>GitHub</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          {!demoMode ? (
            <FooterColumn title="Product" links={productLinks} />
          ) : null}
          <FooterColumn title="Solutions" links={solutionLinks} />
          <FooterColumn title="Resources" links={footerResourceLinks} />
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} {companyName}. {companyTagline}.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/#scope" className="footer-link">
              Scope
            </Link>
            <Link href="/#pricing" className="footer-link">
              Pricing
            </Link>
            <Link href="/help" className="footer-link">
              Help
            </Link>
            <Link href="/contact" className="footer-link">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
