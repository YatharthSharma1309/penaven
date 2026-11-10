export type HiringBoardCandidate = {
  displayName: string;
  status: string;
  createdAt: Date | string;
  jobTitle: string;
  score: number | null;
};

export type HiringBoard = {
  received: number;
  analyzed: number;
  shortlisted: number;
  interviewing: number;
  hired: number;
  notMoving: number;
  addedLast30Days: number;
  averageAlignment: number | null;
  byJob: Array<{ job: string; people: number; hired: number }>;
  scores: Array<{ name: string; score: number }>;
  bands: Array<{ label: string; count: number }>;
  funnel: Array<{ label: string; count: number }>;
  note: string;
};

const MOVED_FORWARD = new Set(["shortlisted", "interviewing", "hired"]);

function firstName(displayName: string) {
  const name = displayName.trim().split(/\s+/)[0];
  return name || "Candidate";
}

export function buildHiringBoard(
  candidates: HiringBoardCandidate[],
  now = new Date(),
): HiringBoard {
  const active = candidates.filter((candidate) => candidate.status !== "archived");
  const scored = active.filter(
    (candidate) => typeof candidate.score === "number" && !Number.isNaN(candidate.score),
  );
  const hired = active.filter((candidate) => candidate.status === "hired");
  const interviewing = active.filter((candidate) => candidate.status === "interviewing");
  const shortlistedNow = active.filter((candidate) => candidate.status === "shortlisted");
  const notMoving = active.filter((candidate) => candidate.status === "rejected");
  const movedForward = active.filter((candidate) => MOVED_FORWARD.has(candidate.status));
  const interviewOrHired = active.filter(
    (candidate) => candidate.status === "interviewing" || candidate.status === "hired",
  );

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const addedLast30Days = active.filter(
    (candidate) => new Date(candidate.createdAt).getTime() >= cutoff.getTime(),
  ).length;

  const averageAlignment =
    scored.length === 0
      ? null
      : Math.round(
          scored.reduce((sum, candidate) => sum + (candidate.score ?? 0), 0) / scored.length,
        );

  const jobs = new Map<string, { people: number; hired: number }>();
  for (const candidate of active) {
    const title = candidate.jobTitle.trim() || "Untitled role";
    const row = jobs.get(title) ?? { people: 0, hired: 0 };
    row.people += 1;
    if (candidate.status === "hired") row.hired += 1;
    jobs.set(title, row);
  }

  const bands = [
    { label: "Strong", count: 0 },
    { label: "Partial", count: 0 },
    { label: "Thin", count: 0 },
    { label: "Gaps", count: 0 },
  ];
  for (const candidate of scored) {
    const score = candidate.score ?? 0;
    if (score >= 80) bands[0].count += 1;
    else if (score >= 60) bands[1].count += 1;
    else if (score >= 40) bands[2].count += 1;
    else bands[3].count += 1;
  }

  // Newest first, not highest first: the percentage is criteria alignment, not a rank.
  const recent = [...scored].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const strong = bands[0].count;
  const note =
    scored.length === 0
      ? "Scores appear after a resume is read against the job criteria."
      : `${strong} of ${scored.length} analyzed resume${scored.length === 1 ? "" : "s"} align with 80% or more of the criteria. Alignment is not a ranking; you still decide who moves forward.`;

  return {
    received: active.length,
    analyzed: scored.length,
    shortlisted: shortlistedNow.length,
    interviewing: interviewing.length,
    hired: hired.length,
    notMoving: notMoving.length,
    addedLast30Days,
    averageAlignment,
    byJob: [...jobs.entries()]
      .map(([job, counts]) => ({ job, ...counts }))
      .sort((a, b) => b.people - a.people),
    scores: recent.slice(0, 8).map((candidate) => ({
      name: firstName(candidate.displayName),
      score: candidate.score ?? 0,
    })),
    bands,
    funnel: [
      { label: "Resumes", count: active.length },
      { label: "Scored", count: scored.length },
      { label: "Moved forward", count: movedForward.length },
      { label: "Interview", count: interviewOrHired.length },
      { label: "Hired", count: hired.length },
    ],
    note,
  };
}
