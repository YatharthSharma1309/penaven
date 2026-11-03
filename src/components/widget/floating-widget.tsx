"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { WIDGET_MESSAGE_TYPE } from "@/lib/widget/embed-snippet";
import { cn } from "@/lib/utils";

type FloatingWidgetProps = {
  hasDocuments: boolean;
  welcomeMessage?: string;
  widgetKey: string;
  widgetChannel?: "WIDGET" | "HELP_CENTER";
  /** The business's name, shown to visitors in the chat header. */
  organizationName?: string;
  initialQuestion?: string | null;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function FloatingWidget({
  hasDocuments,
  welcomeMessage,
  widgetKey,
  widgetChannel = "WIDGET",
  organizationName,
  initialQuestion = null,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: FloatingWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(next: boolean) {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.parent?.postMessage(
      { type: WIDGET_MESSAGE_TYPE, open },
      "*",
    );
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-3 sm:p-5">
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {open ? (
          <div className="origin-bottom-right animate-fade-up">
            <div className="w-[min(100vw-1.5rem,28rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl sm:w-[min(100vw-2.5rem,32rem)]">
              <ChatPanel
                hasDocuments={hasDocuments}
                welcomeMessage={welcomeMessage}
                mode="widget"
                widgetKey={widgetKey}
                widgetChannel={widgetChannel}
                organizationName={organizationName}
                initialQuestion={initialQuestion}
                compact
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          aria-label={open ? "Close support chat" : "Open support chat"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-slate-900/20 transition hover:scale-[1.03] hover:bg-[var(--primary-hover)]",
          )}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
