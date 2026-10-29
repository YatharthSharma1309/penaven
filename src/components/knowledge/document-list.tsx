"use client";



import { useCallback, useEffect, useState } from "react";

import { FileText, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";

import { Dialog } from "@/components/ui/dialog";

import { DocumentUpload } from "@/components/knowledge/document-upload";

import { EmptyState } from "@/components/ui/empty-state";

import { Skeleton } from "@/components/ui/skeleton";

import { formatDate } from "@/lib/utils";



type DocumentItem = {

  id: string;

  title: string;

  fileName: string;

  status: "PROCESSING" | "READY" | "FAILED";

  chunkCount: number;

  fileSize: number;

  errorMessage: string | null;

  createdAt: string;

};



const statusTone = {

  PROCESSING: "warning",

  READY: "success",

  FAILED: "danger",

} as const;



export function DocumentList({ canManage = false }: { canManage?: boolean }) {

  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);



  const loadDocuments = useCallback(async () => {

    setError(null);



    try {

      const response = await fetch("/api/documents");

      const data = await response.json();



      if (!response.ok) {

        throw new Error(data.error ?? "Failed to load documents");

      }



      setDocuments(data.documents);

    } catch (loadError) {

      setError(

        loadError instanceof Error

          ? loadError.message

          : "Failed to load documents",

      );

    } finally {

      setIsLoading(false);

    }

  }, []);



  useEffect(() => {

    queueMicrotask(() => {
      void loadDocuments();
    });

  }, [loadDocuments]);



  useEffect(() => {

    const hasProcessing = documents.some(

      (document) => document.status === "PROCESSING",

    );



    if (!hasProcessing) return;



    const interval = window.setInterval(loadDocuments, 3000);

    return () => window.clearInterval(interval);

  }, [documents, loadDocuments]);



  async function confirmDelete() {

    if (!deleteTarget) return;



    setIsDeleting(true);

    const response = await fetch(`/api/documents/${deleteTarget.id}`, {

      method: "DELETE",

    });



    if (!response.ok) {

      const data = await response.json();

      setError(data.error ?? "Failed to delete document");

      setIsDeleting(false);

      return;

    }



    setDeleteTarget(null);

    setIsDeleting(false);

    await loadDocuments();

  }



  return (

    <div className="space-y-6">

      {canManage ? (
        <DocumentUpload
          onUploaded={() => {
            setIsLoading(true);
            loadDocuments();
          }}
        />
      ) : (
        <p className="text-sm text-slate-500">
          Document uploads are managed by organization admins.
        </p>
      )}



      <Card>

        <div className="mb-5 flex items-center justify-between">

          <div>

            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>

            <p className="text-sm text-slate-500">
              Ready means the next reply can use this file. Could not read means
              upload it again as a text file.
            </p>

          </div>

          <Button variant="secondary" size="sm" onClick={loadDocuments}>

            <RefreshCw className="h-4 w-4" />

            Refresh

          </Button>

        </div>



        {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}



        {isLoading ? (

          <div className="space-y-3" aria-label="Loading documents">

            {Array.from({ length: 3 }).map((_, index) => (

              <div

                key={index}

                className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-4"

              >

                <Skeleton className="h-10 w-10 shrink-0" />

                <div className="flex-1 space-y-2">

                  <Skeleton className="h-4 w-48" />

                  <Skeleton className="h-3 w-32" />

                </div>

              </div>

            ))}

          </div>

        ) : documents.length === 0 ? (

          <EmptyState

            icon={FileText}

            title="No documents yet"

            description="Upload a FAQ, policy, or hours page. The next reply can cite it once the file is Ready."

          />

        ) : (

          <div className="space-y-3">

            {documents.map((document) => (

              <div

                key={document.id}

                className="flex flex-col gap-3 rounded-xl border border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between"

              >

                <div className="flex items-start gap-3">

                  <div className="rounded-lg bg-primary-soft p-2 text-primary">

                    <FileText className="h-4 w-4" />

                  </div>

                  <div>

                    <p className="font-medium text-slate-900">{document.title}</p>

                    <p className="text-sm text-slate-500">{document.fileName}</p>

                    <p className="mt-1 text-xs text-slate-400">
                      {Math.round(document.fileSize / 1024)} KB ·{" "}
                      {formatDate(document.createdAt)}
                    </p>

                    {document.status === "FAILED" ? (
                      <p className="mt-1 text-xs text-rose-700">
                        This file could not be read. Upload it again, or paste the text into a .txt file.
                        {document.errorMessage ? ` ${document.errorMessage}` : ""}
                      </p>
                    ) : null}

                  </div>

                </div>



                <div className="flex items-center gap-3">

                  <Badge tone={statusTone[document.status]}>
                    {document.status === "FAILED"
                      ? "Could not read"
                      : document.status === "PROCESSING"
                        ? "Reading"
                        : "Ready"}
                  </Badge>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${document.title}`}
                      onClick={() => setDeleteTarget(document)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}

                </div>

              </div>

            ))}

          </div>

        )}

      </Card>



      <Dialog

        open={Boolean(deleteTarget)}

        onOpenChange={(open) => {

          if (!open) setDeleteTarget(null);

        }}

        title="Delete document?"

        description={

          deleteTarget

            ? `"${deleteTarget.title}" will be removed from the knowledge base. The chatbot will no longer use it.`

            : undefined

        }

        confirmLabel="Delete"

        variant="danger"

        isLoading={isDeleting}

        onConfirm={confirmDelete}

      />

    </div>

  );

}


