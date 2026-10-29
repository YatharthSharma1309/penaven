import Link from "next/link";
import { Header } from "@/components/layout/header";
import { DocumentList } from "@/components/knowledge/document-list";
import { requireOrgMembershipOrRedirect } from "@/lib/auth";

export default async function KnowledgePage() {
  const { role } = await requireOrgMembershipOrRedirect();
  const canManage = role === "ADMIN";

  return (
    <>
      <Header
        title="Knowledge"
        description="The documents customers are answered from. When a question is not covered, add or update the page here."
      />
      <main id="main-content" className="flex-1 space-y-4 px-4 py-6 sm:p-6 lg:p-8">
        <p className="text-sm text-slate-600">
          Questions the docs did not answer are listed on{" "}
          <Link href="/analytics#knowledge-gaps" className="font-medium text-primary hover:underline">
            Boards
          </Link>
          . Draft a short page there, then it shows up in this list.
        </p>
        <DocumentList canManage={canManage} />
      </main>
    </>
  );
}

