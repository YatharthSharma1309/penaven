"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HiringBoard } from "@/lib/analytics/hiring-board";

const BAND_COLORS = ["#1d4fbf", "#0e9f6e", "#d97706", "#e11d48"];

type HiringBoardViewProps = {
  board: HiringBoard;
};

export function HiringBoardView({ board }: HiringBoardViewProps) {
  const maxFunnel = Math.max(...board.funnel.map((step) => step.count), 1);
  const alignment =
    board.averageAlignment === null ? "—" : `${board.averageAlignment}%`;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Hired"
          value={board.hired}
          hint={
            board.addedLast30Days > 0
              ? `${board.addedLast30Days} resume${board.addedLast30Days === 1 ? "" : "s"} in 30 days`
              : "No new resumes in 30 days"
          }
          className="bg-accent-soft"
        />
        <Metric
          label="In interview"
          value={board.interviewing}
          hint="People in the interview stage"
          className="bg-primary-soft"
        />
        <Metric
          label="Shortlisted"
          value={board.shortlisted}
          hint={`${board.notMoving} not moving forward`}
          className="bg-surface"
        />
        <Metric
          label="Criteria alignment"
          value={alignment}
          hint={
            board.analyzed > 0
              ? `Average across ${board.analyzed} scored resume${board.analyzed === 1 ? "" : "s"}`
              : "No scored resumes yet"
          }
          className="bg-surface"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <article className="rounded-2xl border border-border bg-surface p-5 xl:col-span-3">
          <h2 className="text-sm font-semibold text-foreground">Criteria alignment</h2>
          <p className="mt-1 text-xs text-muted">
            The latest scored resumes, newest first. How closely each quotes the job criteria.
          </p>
          <div className="mt-4 h-64">
            {board.scores.length === 0 ? (
              <p className="text-sm text-muted">No scores yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={board.scores}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                  <Tooltip />
                  <Bar dataKey="score" name="Alignment" fill="#1d4fbf" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">People by role</h2>
          <p className="mt-1 text-xs text-muted">Resumes sitting on each open job.</p>
          <div className="mt-4 h-44">
            {board.byJob.length === 0 ? (
              <p className="text-sm text-muted">No roles yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={board.byJob}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="job" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                  <Tooltip />
                  <Bar dataKey="people" name="People" fill="#0e9f6e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-3 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-sm leading-6 text-foreground">
            {board.note}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">Where people are</h2>
          <p className="mt-1 text-xs text-muted">
            Each later stage includes the people already past it.
          </p>
          <ul className="mt-5 space-y-3">
            {board.funnel.map((step) => (
              <li key={step.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>{step.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{step.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((step.count / maxFunnel) * 100, step.count > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">Score bands</h2>
          <p className="mt-1 text-xs text-muted">
            Strong is 80% or higher. Gaps are under 40%.
          </p>
          <div className="mt-2 grid items-center gap-4 sm:grid-cols-[220px_1fr]">
            <div className="relative h-52">
              {board.analyzed === 0 ? (
                <p className="pt-16 text-sm text-muted">No scored resumes yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={board.bands}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="transparent"
                    >
                      {board.bands.map((band, index) => (
                        <Cell key={band.label} fill={BAND_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {board.averageAlignment !== null ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{alignment}</p>
                  <p className="text-[11px] text-muted">average</p>
                </div>
              ) : null}
            </div>
            <ul className="space-y-2">
              {board.bands.map((band, index) => (
                <li key={band.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: BAND_COLORS[index] }}
                    />
                    {band.label}
                  </span>
                  <span className="tabular-nums text-muted">{band.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl border border-border px-4 py-4 ${className}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}
