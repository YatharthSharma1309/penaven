"use client";

import { cn } from "@/lib/utils";

type OpsConciergeLogoMarkProps = {
  className?: string;
  size?: number;
  /** Kept so existing callers still compile. The mark is flat, so this is unused. */
  gradientId?: string;
};

/**
 * Penaven mark — a filled P on an indigo tile, with a teal page corner.
 * The corner is the document the answer comes from.
 */
export function OpsConciergeLogoMark({
  className,
  size = 32,
}: OpsConciergeLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("block shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#312e81" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M8.2 6.2h8.4c3.7 0 6.1 2.3 6.1 5.7s-2.4 5.7-6.1 5.7H11.6V25.8H8.2V6.2zm3.4 2.8v5.6h4.6c1.7 0 2.8-1.1 2.8-2.8s-1.1-2.8-2.8-2.8h-4.6z"
      />
      <path fill="#2dd4bf" d="M16 32h16V16L16 32z" />
    </svg>
  );
}
