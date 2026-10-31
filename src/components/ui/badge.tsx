import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const tones = {
  default: "bg-primary-soft text-foreground ring-1 ring-inset ring-border",
  success: "bg-success/15 text-success ring-1 ring-inset ring-success/30",
  warning: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30",
  danger: "bg-danger/15 text-danger ring-1 ring-inset ring-danger/30",
  info: "bg-primary-soft text-primary ring-1 ring-inset ring-primary/25 dark:ring-primary/60",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
