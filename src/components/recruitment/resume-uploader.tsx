"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResumeUploaderProps = {
  jobId: string;
  className?: string;
};

export function ResumeUploader({ jobId, className }: ResumeUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    const failures: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(`${index + 1} of ${files.length}`);

      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("file", file);

      try {
        const response = await fetch("/api/recruitment/upload", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          failures.push(`${file.name}: ${data.error ?? "Upload failed"}`);
        }
      } catch {
        failures.push(`${file.name}: Upload failed`);
      }
    }

    setProgress(null);
    setBusy(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (failures.length > 0) {
      setError(failures.join(" "));
    }
    router.refresh();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      void uploadFiles(event.target.files);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          dragOver
            ? "border-teal-400 bg-accent-soft/80"
            : "border-border bg-surface-sunken/50",
        )}
      >
        <Upload className="mb-3 h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">Upload resumes</p>
        <p className="mt-1 text-xs text-muted">
          PDF or DOCX, up to 5MB each. Add several at once. The original file is kept.
        </p>
        {progress ? <p className="mt-2 text-sm text-foreground">Uploading {progress}</p> : null}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          className="sr-only"
          id={`resume-upload-${jobId}`}
          disabled={busy}
          multiple
        />

        <label
          htmlFor={`resume-upload-${jobId}`}
          className={buttonClassName({
            variant: "secondary",
            size: "sm",
            className: cn("mt-4 cursor-pointer", busy && "pointer-events-none opacity-60"),
          })}
        >
          {busy ? `Uploading ${progress ?? ""}`.trim() : "Choose files"}
        </label>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
