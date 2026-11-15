"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ChatPanelSkeleton() {
  return (
    <div className="flex h-full min-h-[28rem] gap-4">
      <Card className="hidden w-64 shrink-0 flex-col overflow-hidden p-0 lg:flex">
        <div className="border-b border-hairline px-4 py-3">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2 p-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Card>
      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="border-b border-hairline px-6 py-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="flex-1 space-y-4 px-6 py-5">
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="ml-auto h-16 w-1/2" />
          <Skeleton className="h-24 w-2/3" />
        </div>
        <div className="border-t border-hairline px-6 py-4">
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    </div>
  );
}

function ChatPanelWithParams({
  hasDocuments,
  welcomeMessage,
}: {
  hasDocuments: boolean;
  welcomeMessage?: string;
}) {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversation");
  const initialQuestion = searchParams.get("q");

  return (
    <div className="min-h-0 flex-1">
      <div className="flex h-full min-h-0 flex-col">
        <ChatPanel
          hasDocuments={hasDocuments}
          welcomeMessage={welcomeMessage}
          initialConversationId={conversationId}
          initialQuestion={initialQuestion}
        />
      </div>
    </div>
  );
}

export function ChatPanelLoader({
  hasDocuments,
  welcomeMessage,
}: {
  hasDocuments: boolean;
  welcomeMessage?: string;
}) {
  return (
    <Suspense fallback={<ChatPanelSkeleton />}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <ChatPanelWithParams
          hasDocuments={hasDocuments}
          welcomeMessage={welcomeMessage}
        />
      </div>
    </Suspense>
  );
}
