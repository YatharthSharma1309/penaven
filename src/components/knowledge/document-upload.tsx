"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentUploadProps = {
  onUploaded: () => void;
};

export function DocumentUpload({ onUploaded }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose a document to upload.");
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      form.reset();
      onUploaded();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-dashed border-border bg-surface-sunken p-6"
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <Upload className="h-4 w-4" />
            <p className="font-medium">Upload support documents</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            PDF, DOCX, TXT, or Markdown. The widget answers only from these files and the pages you import.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <label htmlFor="document-file" className="sr-only">
            Choose document file
          </label>
          <input
            id="document-file"
            type="file"
            name="file"
            accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block w-full text-sm text-foreground-soft file:mr-4 file:rounded-lg file:border-0 file:bg-surface file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground-soft"
          />
          <Button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </form>
  );
}
