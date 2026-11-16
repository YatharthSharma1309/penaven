import { ViewTransition } from "react";

/**
 * A template remounts on every navigation (a layout does not), so the page
 * content can fade out and the next page fade up while the top bar stays put.
 * Browsers without view transitions navigate as before.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
