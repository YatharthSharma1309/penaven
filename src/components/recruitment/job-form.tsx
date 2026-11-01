"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JobDTO } from "@/lib/recruitment/types";

type JobFormProps = {
  job?: JobDTO;
};

function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(items: string[]): string {
  return items.join(", ");
}

export function JobForm({ job }: JobFormProps) {
  const router = useRouter();
  const isEditing = Boolean(job);

  const [title, setTitle] = useState(job?.title ?? "");
  const [clientName, setClientName] = useState(job?.clientName ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [requiredSkills, setRequiredSkills] = useState(
    formatList(job?.requiredSkills ?? []),
  );
  const [preferredSkills, setPreferredSkills] = useState(
    formatList(job?.preferredSkills ?? []),
  );
  const [experienceLevel, setExperienceLevel] = useState(job?.experienceLevel ?? "");
  const [minYearsExperience, setMinYearsExperience] = useState(
    job?.minYearsExperience?.toString() ?? "",
  );
  const [educationRequirements, setEducationRequirements] = useState(
    formatList(job?.educationRequirements ?? []),
  );
  const [certifications, setCertifications] = useState(
    formatList(job?.certifications ?? []),
  );
  const [roleType, setRoleType] = useState(job?.roleType ?? "");

  const [busy, setBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssist() {
    if (!title.trim()) {
      setError("Enter a job title before using AI assist.");
      return;
    }

    setAssistBusy(true);
    setError(null);

    const response = await fetch("/api/recruitment/jobs/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "AI assist failed");
      setAssistBusy(false);
      return;
    }

    const suggestion = data.suggestion;
    if (suggestion.description) setDescription(suggestion.description);
    if (suggestion.requiredSkills?.length) {
      setRequiredSkills(formatList(suggestion.requiredSkills));
    }
    if (suggestion.preferredSkills?.length) {
      setPreferredSkills(formatList(suggestion.preferredSkills));
    }
    if (suggestion.experienceLevel) setExperienceLevel(suggestion.experienceLevel);
    if (suggestion.minYearsExperience !== null && suggestion.minYearsExperience !== undefined) {
      setMinYearsExperience(String(suggestion.minYearsExperience));
    }
    if (suggestion.educationRequirements?.length) {
      setEducationRequirements(formatList(suggestion.educationRequirements));
    }
    if (suggestion.certifications?.length) {
      setCertifications(formatList(suggestion.certifications));
    }
    if (suggestion.roleType) setRoleType(suggestion.roleType);

    setAssistBusy(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      title,
      clientName,
      description,
      requiredSkills: parseList(requiredSkills),
      preferredSkills: parseList(preferredSkills),
      experienceLevel: experienceLevel.trim() || null,
      minYearsExperience: minYearsExperience.trim()
        ? Number.parseInt(minYearsExperience, 10)
        : null,
      educationRequirements: parseList(educationRequirements),
      certifications: parseList(certifications),
      roleType: roleType.trim() || null,
    };

    const url = isEditing ? `/api/recruitment/jobs/${job!.id}` : "/api/recruitment/jobs";
    const method = isEditing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to save job");
      setBusy(false);
      return;
    }

    router.push(`/recruitment/jobs/${data.job.id}`);
    router.refresh();
  }

  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label htmlFor="job-title" className="mb-2 block text-sm font-medium text-slate-700">
              Job title
            </label>
            <Input
              id="job-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="Senior Frontend Engineer"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAssist}
            disabled={assistBusy || !title.trim()}
          >
            <Sparkles className="h-4 w-4" />
            {assistBusy ? "Generating..." : "AI assist"}
          </Button>
        </div>

        <div>
          <label htmlFor="job-client" className="mb-2 block text-sm font-medium text-slate-700">
            Client
          </label>
          <Input
            id="job-client"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="The company this role is for"
            maxLength={120}
          />
        </div>

        <div>
          <label
            htmlFor="job-description"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <Textarea
            id="job-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={6}
            placeholder="Describe the role, responsibilities, and team context..."
          />
        </div>

        <div>
          <label
            htmlFor="required-skills"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Required skills
          </label>
          <Textarea
            id="required-skills"
            value={requiredSkills}
            onChange={(event) => setRequiredSkills(event.target.value)}
            required
            rows={2}
            placeholder="React, TypeScript, Node.js (comma-separated)"
          />
        </div>

        <div>
          <label
            htmlFor="preferred-skills"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Preferred skills
          </label>
          <Textarea
            id="preferred-skills"
            value={preferredSkills}
            onChange={(event) => setPreferredSkills(event.target.value)}
            rows={2}
            placeholder="GraphQL, AWS (comma-separated)"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="experience-level"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Experience level
            </label>
            <Select
              id="experience-level"
              value={experienceLevel}
              onChange={(event) => setExperienceLevel(event.target.value)}
            >
              <option value="">Not specified</option>
              <option value="Junior">Junior</option>
              <option value="Mid-level">Mid-level</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead</option>
              <option value="Principal">Principal</option>
            </Select>
          </div>

          <div>
            <label
              htmlFor="min-years"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Minimum years of experience
            </label>
            <Input
              id="min-years"
              type="number"
              min={0}
              max={60}
              value={minYearsExperience}
              onChange={(event) => setMinYearsExperience(event.target.value)}
              placeholder="3"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="education"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Education requirements
            </label>
            <Textarea
              id="education"
              value={educationRequirements}
              onChange={(event) => setEducationRequirements(event.target.value)}
              rows={2}
              placeholder="Bachelor's in CS (comma-separated)"
            />
          </div>

          <div>
            <label
              htmlFor="certifications"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Certifications
            </label>
            <Textarea
              id="certifications"
              value={certifications}
              onChange={(event) => setCertifications(event.target.value)}
              rows={2}
              placeholder="AWS Solutions Architect (comma-separated)"
            />
          </div>
        </div>

        <div>
          <label htmlFor="role-type" className="mb-2 block text-sm font-medium text-slate-700">
            Role type
          </label>
          <Input
            id="role-type"
            value={roleType}
            onChange={(event) => setRoleType(event.target.value)}
            placeholder="Full-time, Remote"
          />
        </div>

        {isEditing ? (
          <p className="text-sm text-amber-700">
            Changing the description or criteria clears existing candidate analyses so they can be re-run.
          </p>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : isEditing ? "Save changes" : "Create job"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
