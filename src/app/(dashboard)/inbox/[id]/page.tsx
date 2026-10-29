import { Header } from "@/components/layout/header";
import { ConversationReview } from "@/components/inbox/conversation-review";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";
import { customerConversationWhere } from "@/lib/conversations/filters";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type InboxConversationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InboxConversationPage({
  params,
}: InboxConversationPageProps) {
  const { organization } = await requireOrgMembershipOrRedirect();
  const { id } = await params;

  const conversation = await db.conversation.findFirst({
    where: {
      id,
      ...customerConversationWhere(organization.id),
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      tickets: {
        select: { id: true, status: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!conversation) {
    notFound();
  }

  return (
    <>
      <Header
        title="Conversation"
        description="The reply, the passage it used, and a page to draft when the docs did not cover the question."
      />
      <main id="main-content" className="flex-1 px-4 py-6 sm:p-6 lg:p-8">
        <ConversationReview conversation={conversation} />
      </main>
    </>
  );
}
