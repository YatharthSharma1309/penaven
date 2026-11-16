"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  averageScore,
  buildInterviewScorecard,
  RECOMMENDATION_LABELS,
} from "@/lib/recruitment/interview-scorecard";
import type {
  InterviewRecommendation,
  InterviewScorecard,
} from "@/lib/recruitment/types";
import { cn, formatDate } from "@/lib/utils";

type InterviewScorecardPanelProps = {
  candidateId: string;
  candidateName: string;
  requiredSkills: string[];
  interviewQuestions: string[];
  missingSkills: string[];
  initialScorecard: InterviewScorecard | null;
};

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

function ScoreSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      id={id}
      value={value === null ? "" : String(value)}
      disabled={disabled}
      className="w-24"
      onChange={(event) => {
        const next = event.target.value;
        onChange(next ? Number(next) : null);
      }}
    >
      <option value="">—</option>
      {SCORE_OPTIONS.map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </Select>
  );
}

export function InterviewScorecardPanel({
  candidateId,
  candidateName,
  requiredSkills,
  interviewQuestions,
  missingSkills,
  initialScorecard,
}: InterviewScorecardPanelProps) {
  const router = useRouter();
  const [scorecard, setScorecard] = useState(() =>
    buildInterviewScorecard(initialScorecard, requiredSkills, interviewQuestions),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(initialScorecard?.updatedAt ?? null);

  const skillAverage = useMemo(
    () => averageScore(scorecard.skillScores.map((row) => row.score)),
    [scorecard.skillScores],
  );
  const questionAverage = useMemo(
    () => averageScore(scorecard.questionScores.map((row) => row.score)),
    [scorecard.questionScores],
  );

  async function saveScorecard() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewScorecard: {
            skillScores: scorecard.skillScores,
            questionScores: scorecard.questionScores,
            overallNotes: scorecard.overallNotes,
            recommendation: scorecard.recommendation,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to save scorecard");
        return;
      }

      const next = data.candidate?.interviewScorecard as InterviewScorecard | undefined;
      if (next?.updatedAt) {
        setSavedAt(next.updatedAt);
      } else {
        setSavedAt(new Date().toISOString());
      }
      router.refresh();
    } catch {
      setError("Network error while saving scorecard.");
    } finally {
      setIsSaving(false);
    }
  }

  if (requiredSkills.length === 0 && interviewQuestions.length === 0) {
    return (
      <Card>
        <CardTitle>Interview scorecard</CardTitle>
        <CardDescription className="mt-2">
          Run AI analysis (and ensure the job has required skills) to unlock a live
          scorecard for {candidateName}.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-accent print:hidden" />
            Interview scorecard
          </CardTitle>
          <CardDescription className="mt-1">
            Rate must-have skills and AI interview questions during the live call.
            {savedAt ? ` Last saved ${formatDate(savedAt)}.` : ""}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => void saveScorecard()}
          >
            {isSaving ? "Saving..." : "Save scorecard"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {skillAverage !== null ? (
          <Badge tone="info">Skills avg {skillAverage}/5</Badge>
        ) : null}
        {questionAverage !== null ? (
          <Badge tone="info">Questions avg {questionAverage}/5</Badge>
        ) : null}
        {scorecard.recommendation ? (
          <Badge tone="success">
            {RECOMMENDATION_LABELS[scorecard.recommendation]}
          </Badge>
        ) : null}
      </div>

      {missingSkills.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm text-amber-900">
          Resume gaps to probe: {missingSkills.join(", ")}
        </div>
      ) : null}

      {scorecard.skillScores.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Must-have skills (1–5)
          </h3>
          {scorecard.skillScores.map((row, index) => (
            <div
              key={row.skill}
              className="rounded-xl border border-hairline bg-surface-sunken/40 px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{row.skill}</p>
                <ScoreSelect
                  id={`skill-score-${index}`}
                  value={row.score}
                  onChange={(score) =>
                    setScorecard((current) => ({
                      ...current,
                      skillScores: current.skillScores.map((item, i) =>
                        i === index ? { ...item, score } : item,
                      ),
                    }))
                  }
                />
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                placeholder="Evidence / notes from the interview"
                value={row.notes}
                onChange={(event) =>
                  setScorecard((current) => ({
                    ...current,
                    skillScores: current.skillScores.map((item, i) =>
                      i === index ? { ...item, notes: event.target.value } : item,
                    ),
                  }))
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {scorecard.questionScores.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Interview questions
          </h3>
          {scorecard.questionScores.map((row, index) => (
            <div
              key={row.question}
              className="rounded-xl border border-teal-100 bg-accent-soft/50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border text-blue-900 focus:ring-blue-800"
                    checked={row.asked}
                    onChange={(event) =>
                      setScorecard((current) => ({
                        ...current,
                        questionScores: current.questionScores.map((item, i) =>
                          i === index
                            ? { ...item, asked: event.target.checked }
                            : item,
                        ),
                      }))
                    }
                  />
                  <span className={cn(!row.asked && "text-muted")}>
                    {row.question}
                  </span>
                </label>
                <ScoreSelect
                  id={`question-score-${index}`}
                  value={row.score}
                  disabled={!row.asked}
                  onChange={(score) =>
                    setScorecard((current) => ({
                      ...current,
                      questionScores: current.questionScores.map((item, i) =>
                        i === index ? { ...item, score } : item,
                      ),
                    }))
                  }
                />
              </div>
              {row.asked ? (
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Answer notes"
                  value={row.notes}
                  onChange={(event) =>
                    setScorecard((current) => ({
                      ...current,
                      questionScores: current.questionScores.map((item, i) =>
                        i === index
                          ? { ...item, notes: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="interview-recommendation"
            className="mb-1.5 block text-sm font-medium text-foreground-soft"
          >
            Recommendation
          </label>
          <Select
            id="interview-recommendation"
            value={scorecard.recommendation ?? ""}
            onChange={(event) =>
              setScorecard((current) => ({
                ...current,
                recommendation: (event.target.value ||
                  null) as InterviewRecommendation | null,
              }))
            }
          >
            <option value="">Not set</option>
            {(Object.keys(RECOMMENDATION_LABELS) as InterviewRecommendation[]).map(
              (key) => (
                <option key={key} value={key}>
                  {RECOMMENDATION_LABELS[key]}
                </option>
              ),
            )}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="interview-overall-notes"
            className="mb-1.5 block text-sm font-medium text-foreground-soft"
          >
            Overall notes
          </label>
          <Textarea
            id="interview-overall-notes"
            rows={4}
            value={scorecard.overallNotes}
            placeholder="Hire decision notes, culture fit, next steps…"
            onChange={(event) =>
              setScorecard((current) => ({
                ...current,
                overallNotes: event.target.value,
              }))
            }
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </Card>
  );
}
