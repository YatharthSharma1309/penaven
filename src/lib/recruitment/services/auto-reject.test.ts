import { beforeEach, describe, expect, it, vi } from "vitest";

/** Drives the real auto-reject service against a small in-memory Prisma fake. */

type Row = Record<string, unknown> & { id: string };

const store = vi.hoisted(() => ({
  jobs: [] as Row[],
  candidates: [] as Row[],
  analyses: [] as Row[],
  audit: [] as Row[],
  demo: false,
}));

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "job") {
      const job = store.jobs.find((item) => item.id === row.jobId);
      return Boolean(job) && matches(job as Row, condition as Record<string, unknown>);
    }
    const value = row[key];
    if (condition === null || typeof condition !== "object" || condition instanceof Date) {
      return value === condition;
    }
    const filter = condition as { not?: unknown };
    if ("not" in filter) return filter.not === null ? value !== null : value !== filter.not;
    return true;
  });
}

function withRelations(row: Row) {
  return {
    ...row,
    job: store.jobs.find((job) => job.id === row.jobId),
    analysis: store.analyses.find((analysis) => analysis.candidateId === row.id) ?? null,
  };
}

vi.mock("@/lib/env/public-demo", () => ({ isPublicDemoMode: () => store.demo }));

vi.mock("@/lib/recruitment/services/hire-safety", () => ({
  releasePendingHire: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => {
  const candidate = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = store.candidates.find((item) => matches(item, where));
      return row ? withRelations(row) : null;
    }),
    findFirstOrThrow: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = store.candidates.find((item) => matches(item, where));
      if (!row) throw new Error("not found");
      return withRelations(row);
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = store.candidates.filter((item) => matches(item, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    ),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.candidates.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return withRelations(row);
      },
    ),
  };
  const job = {
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = store.jobs.filter((item) => matches(item, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    ),
  };
  const recruitmentAuditEvent = {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `audit_${store.audit.length + 1}`, ...data };
      store.audit.push(row);
      return row;
    }),
  };
  const candidateAnalysis = { deleteMany: vi.fn(async () => ({ count: 0 })) };
  const db = {
    candidate,
    job,
    recruitmentAuditEvent,
    candidateAnalysis,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return { db };
});

const { applyAutoReject, setAutoReject, undoAutoReject } = await import(
  "@/lib/recruitment/services/auto-reject"
);
const { updateCandidate } = await import("@/lib/recruitment/services/candidates");
const { describeAuditEvent } = await import("@/lib/recruitment/services/audit");

type Evidence = { skill: string; matchType: string; evidence: string };

const WIDE = "missing_or_contradicts";
const SQL_CONTRADICTED: Evidence[] = [
  { skill: "Zendesk", matchType: "exact", evidence: "Zendesk admin" },
  { skill: "SQL", matchType: "exact", evidence: "I have never used SQL" },
];

function seed(options: {
  enabled?: boolean;
  mode?: string;
  status?: string;
  overridden?: boolean;
  evidence?: Evidence[];
  score?: number;
}) {
  store.jobs = [
    {
      id: "job_1",
      organizationId: "org_1",
      title: "Support lead",
      requiredSkills: JSON.stringify(["Zendesk", "SQL"]),
      autoRejectEnabled: options.enabled ?? true,
      // The schema default.
      autoRejectMode: options.mode ?? "contradicts",
    },
  ];
  store.candidates = [
    {
      id: "cand_1",
      jobId: "job_1",
      displayName: "Asha Rao",
      status: options.status ?? "new",
      rawText: "resume",
      parseStatus: "ok",
      notes: null,
      interviewScorecard: null,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      autoRejectedAt: null,
      autoRejectReason: null,
      autoRejectPrevious: null,
      autoRejectOverridden: options.overridden ?? false,
    },
  ];
  store.analyses = [
    {
      id: "an_1",
      candidateId: "cand_1",
      summary: "s",
      extractedSkills: "[]",
      matchScore: options.score ?? 92,
      scoreBreakdown: JSON.stringify({
        matchedRequiredSkills: ["Zendesk"],
        missingRequiredSkills: ["SQL"],
        requiredSkillEvidence: options.evidence ?? [
          { skill: "Zendesk", matchType: "exact", evidence: "Ran Zendesk for 3 years" },
        ],
      }),
      matchRationale: "r",
      missingSkills: "[]",
      interviewQuestions: "[]",
      modelId: null,
      analyzedAt: new Date("2026-11-01T00:00:00Z"),
    },
  ];
  store.audit = [];
}

const run = () => applyAutoReject({ organizationId: "org_1", candidateId: "cand_1", actorId: "user_1" });
const candidate = () => store.candidates[0];

beforeEach(() => {
  store.demo = false;
});

describe("applyAutoReject", () => {
  it("by default rejects when the resume contradicts a must-have, and logs why and the mode", async () => {
    seed({ score: 92, evidence: SQL_CONTRADICTED });
    const outcome = await run();

    expect(outcome).toEqual({ rejected: true, reasons: [{ skill: "SQL", verdict: "contradictory" }] });
    expect(candidate().status).toBe("rejected");
    expect(candidate().autoRejectedAt).toBeInstanceOf(Date);
    expect(candidate().autoRejectPrevious).toBe("new");
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0].action).toBe("candidate.auto_reject");
    expect(JSON.parse(store.audit[0].metadata as string)).toMatchObject({
      jobId: "job_1",
      candidateName: "Asha Rao",
      reasons: "SQL (resume contradicts it)",
      mode: "contradicts",
    });
  });

  it("by default does not reject when a must-have is only Not shown", async () => {
    seed({ score: 92 });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
    expect(store.audit).toHaveLength(0);
  });

  it("treats an unknown stored mode as Contradicts only", async () => {
    seed({ mode: "something_else" });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("in Not shown or Contradicts mode rejects a must-have that is not shown, even with a high score", async () => {
    seed({ mode: WIDE, score: 92 });
    const outcome = await run();

    expect(outcome).toEqual({ rejected: true, reasons: [{ skill: "SQL", verdict: "not_shown" }] });
    expect(candidate().status).toBe("rejected");
    expect(JSON.parse(store.audit[0].metadata as string)).toMatchObject({
      reasons: "SQL (not shown)",
      mode: WIDE,
    });
  });

  it("in Not shown or Contradicts mode also rejects on Contradicts", async () => {
    seed({ mode: WIDE, evidence: SQL_CONTRADICTED });
    const outcome = await run();
    expect(outcome).toEqual({ rejected: true, reasons: [{ skill: "SQL", verdict: "contradictory" }] });
  });

  it("does not reject if an admin changed the mode after the screen was read", async () => {
    seed({ mode: WIDE });
    const { db } = await import("@/lib/db");
    const findFirst = vi.mocked(db.candidate.findFirst);
    const original = findFirst.getMockImplementation() as unknown as (args: unknown) => Promise<unknown>;
    findFirst.mockImplementationOnce((async (args: unknown) => {
      const row = await original(args);
      store.jobs[0].autoRejectMode = "contradicts";
      return row;
    }) as never);
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("does nothing while the role has it off", async () => {
    seed({ enabled: false });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
    expect(store.audit).toHaveLength(0);
  });

  it("never rejects on a low score when every must-have is shown", async () => {
    seed({
      score: 12,
      evidence: [
        { skill: "Zendesk", matchType: "exact", evidence: "Zendesk" },
        { skill: "SQL", matchType: "semantic", evidence: "Wrote SQL reports" },
      ],
    });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("leaves alone anyone a person has already moved", async () => {
    seed({ mode: WIDE, status: "shortlisted" });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("shortlisted");
  });

  it("does not fire again after a person undid it", async () => {
    seed({ mode: WIDE, overridden: true });
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("never runs on the public demo", async () => {
    seed({ mode: WIDE });
    store.demo = true;
    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("does not touch another workspace's candidate", async () => {
    seed({ mode: WIDE });
    const outcome = await applyAutoReject({
      organizationId: "org_2",
      candidateId: "cand_1",
      actorId: null,
    });
    expect(outcome).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });
});

describe("undoAutoReject", () => {
  it("puts the person back on New, logs it, and stops auto-reject for them", async () => {
    seed({ mode: WIDE });
    await run();
    const dto = await undoAutoReject({ organizationId: "org_1", candidateId: "cand_1", actorId: "user_2" });

    expect(dto.status).toBe("new");
    expect(dto.autoRejection).toBeNull();
    expect(candidate().autoRejectOverridden).toBe(true);
    expect(store.audit.map((event) => event.action)).toEqual([
      "candidate.auto_reject",
      "candidate.auto_reject_undo",
    ]);

    expect(await run()).toEqual({ rejected: false });
    expect(candidate().status).toBe("new");
  });

  it("refuses when the person was not auto-rejected", async () => {
    seed({ status: "rejected" });
    await expect(
      undoAutoReject({ organizationId: "org_1", candidateId: "cand_1", actorId: "user_2" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("a person's own status change", () => {
  it("replaces the auto-reject and keeps it from coming back", async () => {
    seed({ mode: WIDE });
    await run();
    const dto = await updateCandidate({
      organizationId: "org_1",
      candidateId: "cand_1",
      status: "shortlisted",
    });

    expect(dto.status).toBe("shortlisted");
    expect(dto.autoRejection).toBeNull();
    expect(candidate().autoRejectedAt).toBeNull();
    expect(candidate().autoRejectOverridden).toBe(true);
  });

  it("a notes edit keeps the auto-reject label", async () => {
    seed({ mode: WIDE });
    await run();
    const dto = await updateCandidate({ organizationId: "org_1", candidateId: "cand_1", notes: "Call back" });
    expect(dto.autoRejection?.reasons).toEqual([{ skill: "SQL", verdict: "not_shown" }]);
  });
});

describe("setAutoReject", () => {
  it("turns the role's setting on and logs it, only inside the workspace", async () => {
    seed({ enabled: false });
    expect(await setAutoReject({ organizationId: "org_2", jobId: "job_1", enabled: true, actorId: "u" })).toBe(false);
    expect(store.jobs[0].autoRejectEnabled).toBe(false);

    expect(await setAutoReject({ organizationId: "org_1", jobId: "job_1", enabled: true, actorId: "u" })).toBe(true);
    expect(store.jobs[0].autoRejectEnabled).toBe(true);
    expect(store.jobs[0].autoRejectMode).toBe("contradicts");
    expect(store.audit[0].action).toBe("job.auto_reject_setting");
    expect(JSON.parse(store.audit[0].metadata as string)).toEqual({ enabled: true, mode: "contradicts" });
  });

  it("stores the chosen mode when turning on, and keeps it when turning off", async () => {
    seed({ enabled: false });
    await setAutoReject({ organizationId: "org_1", jobId: "job_1", enabled: true, mode: WIDE, actorId: "u" });
    expect(store.jobs[0].autoRejectMode).toBe(WIDE);

    await setAutoReject({ organizationId: "org_1", jobId: "job_1", enabled: false, actorId: "u" });
    expect(store.jobs[0].autoRejectEnabled).toBe(false);
    expect(store.jobs[0].autoRejectMode).toBe(WIDE);
    expect(JSON.parse(store.audit[1].metadata as string)).toEqual({ enabled: false });
  });
});

describe("activity log wording", () => {
  it("names the person, the must-have and the mode", () => {
    expect(
      describeAuditEvent({
        action: "candidate.auto_reject",
        metadata: { candidateName: "Asha Rao", reasons: "SQL (not shown)" },
      }),
    ).toBe("Asha Rao auto-rejected. Reason: SQL (not shown)");
    expect(
      describeAuditEvent({
        action: "candidate.auto_reject",
        metadata: { candidateName: "Asha Rao", reasons: "SQL (resume contradicts it)" },
      }),
    ).toBe("Asha Rao auto-rejected. Reason: SQL (resume contradicts it)");
    expect(
      describeAuditEvent({ action: "job.auto_reject_setting", metadata: { enabled: true, mode: "contradicts" } }),
    ).toBe("Auto-reject turned on: rejects only when the resume contradicts a required skill");
    expect(
      describeAuditEvent({ action: "job.auto_reject_setting", metadata: { enabled: true, mode: WIDE } }),
    ).toBe("Auto-reject turned on: rejects when a required skill is Not shown or Contradicts");
    expect(describeAuditEvent({ action: "job.auto_reject_setting", metadata: { enabled: true } })).toBe(
      "Auto-reject turned on",
    );
    expect(describeAuditEvent({ action: "job.auto_reject_setting", metadata: { enabled: false } })).toBe(
      "Auto-reject turned off",
    );
    expect(describeAuditEvent({ action: "job.update", metadata: null })).toBe("Job updated");
  });
});

describe("banner headline", () => {
  it("words the lead-in for the verdicts that triggered it", async () => {
    const { describeAutoRejectHeadline } = await import("@/lib/recruitment/auto-reject");
    expect(describeAutoRejectHeadline([{ skill: "SQL", verdict: "contradictory" }])).toBe(
      "The resume contradicts a must-have",
    );
    expect(describeAutoRejectHeadline([{ skill: "SQL", verdict: "not_shown" }])).toBe(
      "The resume does not show a must-have",
    );
    expect(
      describeAutoRejectHeadline([
        { skill: "SQL", verdict: "not_shown" },
        { skill: "Zendesk", verdict: "contradictory" },
      ]),
    ).toBe("The resume contradicts a must-have or does not show it");
  });
});
