import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the real hiring services. Prisma is an in-memory fake with the same
 * filters, cascades, and transaction rollback the services rely on, so no
 * database is needed.
 */

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;
type Args = {
  where?: Where;
  data?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

const store = vi.hoisted(() => ({
  jobs: [] as Row[],
  candidates: [] as Row[],
  analyses: [] as Row[],
  audit: [] as Row[],
}));

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") {
      return (condition as Where[]).some((branch) => matches(row, branch));
    }
    if (key === "job") {
      const job = store.jobs.find((item) => item.id === row.jobId);
      return Boolean(job) && matches(job as Row, condition as Where);
    }
    if (key === "candidate") {
      const candidate = store.candidates.find((item) => item.id === row.candidateId);
      return Boolean(candidate) && matches(candidate as Row, condition as Where);
    }

    const value = row[key];
    if (condition === null || typeof condition !== "object") {
      return value === condition;
    }

    const filter = condition as {
      not?: unknown;
      in?: unknown[];
      notIn?: unknown[];
      gte?: Date;
      lte?: Date;
    };
    if ("not" in filter && value === filter.not) return false;
    if (filter.in && !filter.in.includes(value)) return false;
    if (filter.notIn && filter.notIn.includes(value)) return false;
    if (filter.gte && !((value as Date) >= filter.gte)) return false;
    if (filter.lte && !((value as Date) <= filter.lte)) return false;
    return true;
  });
}

function withCandidateIncludes(row: Row, args: Args = {}) {
  return {
    ...row,
    ...(args.include?.job
      ? { job: store.jobs.find((job) => job.id === row.jobId) }
      : {}),
    ...(args.include?.analysis
      ? {
          analysis:
            store.analyses.find((analysis) => analysis.candidateId === row.id) ?? null,
        }
      : {}),
  };
}

function removeCandidates(ids: unknown[]) {
  store.candidates = store.candidates.filter((row) => !ids.includes(row.id));
  store.analyses = store.analyses.filter((row) => !ids.includes(row.candidateId));
}

vi.mock("@/lib/db", () => {
  const job = {
    findFirst: vi.fn(async (args: Args) => {
      const row = store.jobs.find((item) => matches(item, args.where));
      if (!row) return null;
      return args.include?.candidates
        ? {
            ...row,
            candidates: store.candidates
              .filter((item) => item.jobId === row.id)
              .map((item) => ({ ...item })),
          }
        : { ...row };
    }),
    findMany: vi.fn(async (args: Args) =>
      store.jobs.filter((item) => matches(item, args.where)).map((item) => ({ ...item })),
    ),
    update: vi.fn(async (args: Args) => {
      const row = store.jobs.find((item) => matches(item, args.where));
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      Object.assign(row, args.data);
      return { ...row };
    }),
    updateMany: vi.fn(async (args: Args) => {
      const rows = store.jobs.filter((item) => matches(item, args.where));
      rows.forEach((row) => Object.assign(row, args.data));
      return { count: rows.length };
    }),
  };

  const candidate = {
    create: vi.fn(async (args: Args) => {
      const row: Row = {
        id: `upload_${store.candidates.length + 1}`,
        status: "new",
        statusBeforeArchive: null,
        notes: null,
        interviewScorecard: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      store.candidates.push(row);
      return withCandidateIncludes(row, args);
    }),
    findFirst: vi.fn(async (args: Args) => {
      const row = store.candidates.find((item) => matches(item, args.where));
      return row ? withCandidateIncludes(row, args) : null;
    }),
    findMany: vi.fn(async (args: Args) =>
      store.candidates
        .filter((item) => matches(item, args.where))
        .map((item) => ({ ...item })),
    ),
    update: vi.fn(async (args: Args) => {
      const row = store.candidates.find((item) => matches(item, args.where));
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      Object.assign(row, args.data);
      return withCandidateIncludes(row, args);
    }),
    updateMany: vi.fn(async (args: Args) => {
      const rows = store.candidates.filter((item) => matches(item, args.where));
      rows.forEach((row) => Object.assign(row, args.data));
      return { count: rows.length };
    }),
    delete: vi.fn(async (args: Args) => {
      const row = store.candidates.find((item) => matches(item, args.where));
      if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
      removeCandidates([row.id]);
      return row;
    }),
    deleteMany: vi.fn(async (args: Args) => {
      const ids = store.candidates
        .filter((item) => matches(item, args.where))
        .map((item) => item.id);
      removeCandidates(ids);
      return { count: ids.length };
    }),
    count: vi.fn(
      async (args: Args) =>
        store.candidates.filter((item) => matches(item, args.where)).length,
    ),
  };

  const candidateAnalysis = {
    count: vi.fn(
      async (args: Args) =>
        store.analyses.filter((item) => matches(item, args.where)).length,
    ),
    deleteMany: vi.fn(async (args: Args) => {
      const kept = store.analyses.filter((item) => !matches(item, args.where));
      const count = store.analyses.length - kept.length;
      store.analyses = kept;
      return { count };
    }),
  };

  const recruitmentAuditEvent = {
    count: vi.fn(
      async (args: Args) => store.audit.filter((item) => matches(item, args.where)).length,
    ),
  };

  const client = { job, candidate, candidateAnalysis, recruitmentAuditEvent };

  const snapshot = () =>
    structuredClone({
      jobs: store.jobs,
      candidates: store.candidates,
      analyses: store.analyses,
    });

  return {
    db: {
      ...client,
      $transaction: vi.fn(async (work: unknown) => {
        const before = snapshot();
        try {
          return typeof work === "function"
            ? await (work as (tx: typeof client) => Promise<unknown>)(client)
            : await Promise.all(work as Promise<unknown>[]);
        } catch (error) {
          Object.assign(store, before);
          throw error;
        }
      }),
    },
  };
});

import { countResumeScreensThisMonth } from "@/lib/billing/usage";
import { db } from "@/lib/db";
import { RESUME_SCREEN_AUDIT_ACTION } from "@/lib/recruitment/services/audit";
import {
  createCandidateFromUpload,
  deleteCandidate,
  updateCandidate,
} from "@/lib/recruitment/services/candidates";
import {
  finalizePendingHire,
  getPendingHireState,
  processExpiredPendingHires,
  undoPendingHire,
} from "@/lib/recruitment/services/hire-safety";
import { updateJob } from "@/lib/recruitment/services/jobs";

const ORG = "org_1";
const JOB = "job_1";

function seedJob(overrides: Record<string, unknown> = {}) {
  store.jobs.push({
    id: JOB,
    organizationId: ORG,
    title: "Support Lead",
    clientName: "Harbor",
    description: "Lead the support team through a busy season.",
    requiredSkills: '["Zendesk"]',
    preferredSkills: '["SQL"]',
    experienceLevel: "Senior",
    minYearsExperience: 5,
    educationRequirements: "[]",
    certifications: "[]",
    roleType: "Full-time",
    shareToken: null,
    pendingHireCandidateId: null,
    pendingHireExpiresAt: null,
    pendingHirePreviousStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function seedCandidate(id: string, status: string, overrides: Record<string, unknown> = {}) {
  store.candidates.push({
    id,
    jobId: JOB,
    displayName: id,
    fileName: null,
    mimeType: null,
    filePath: null,
    rawText: "Resume text ".repeat(10),
    parseStatus: "manual",
    status,
    statusBeforeArchive: null,
    notes: null,
    interviewScorecard: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function seedAnalysis(candidateId: string, analyzedAt = new Date()) {
  store.analyses.push({
    id: `analysis_${candidateId}`,
    candidateId,
    summary: "Summary",
    extractedSkills: "[]",
    matchScore: 80,
    scoreBreakdown: "{}",
    matchRationale: "Rationale",
    missingSkills: "[]",
    interviewQuestions: "[]",
    modelId: "free-model",
    analyzedAt,
  });
}

function seedScreenEvent(createdAt = new Date()) {
  store.audit.push({
    id: `audit_${store.audit.length + 1}`,
    organizationId: ORG,
    action: RESUME_SCREEN_AUDIT_ACTION,
    createdAt,
  });
}

function statusOf(id: string) {
  return store.candidates.find((candidate) => candidate.id === id)?.status;
}

function job() {
  return store.jobs.find((item) => item.id === JOB) as Row;
}

function expectNoPendingHire() {
  expect(job().pendingHireCandidateId).toBeNull();
  expect(job().pendingHireExpiresAt).toBeNull();
  expect(job().pendingHirePreviousStatus).toBeNull();
}

function hire(candidateId: string) {
  return updateCandidate({
    organizationId: ORG,
    candidateId,
    status: "hired",
  });
}

const jobInput = {
  title: "Support Lead",
  clientName: "Harbor",
  description: "Lead the support team through a busy season.",
  requiredSkills: ["Zendesk"],
  preferredSkills: ["SQL"],
  experienceLevel: "Senior",
  minYearsExperience: 5,
  educationRequirements: [],
  certifications: [],
  roleType: "Full-time",
};

beforeEach(() => {
  store.jobs = [];
  store.candidates = [];
  store.analyses = [];
  store.audit = [];
});

describe("changing the status of a pending hire", () => {
  beforeEach(async () => {
    seedJob();
    seedCandidate("x", "shortlisted");
    seedCandidate("y", "interviewing");
    seedCandidate("z", "rejected");
    await hire("x");
  });

  it("clears the pending hire, restores the others, and keeps the new status", async () => {
    expect(statusOf("y")).toBe("archived");

    await updateCandidate({ organizationId: ORG, candidateId: "x", status: "interviewing" });

    expectNoPendingHire();
    expect(statusOf("x")).toBe("interviewing");
    expect(statusOf("y")).toBe("interviewing");
    expect(statusOf("z")).toBe("rejected");
    expect(store.candidates.find((row) => row.id === "y")?.statusBeforeArchive).toBeNull();
  });

  it("leaves nothing for finalize to delete", async () => {
    await updateCandidate({ organizationId: ORG, candidateId: "x", status: "interviewing" });

    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({
      code: "NO_PENDING_HIRE",
    });
    expect(store.candidates).toHaveLength(3);
  });

  it("does not disturb the pending hire on an edit that keeps hired status", async () => {
    await updateCandidate({ organizationId: ORG, candidateId: "x", notes: "Signed offer" });
    await updateCandidate({ organizationId: ORG, candidateId: "x", status: "hired" });

    expect(job().pendingHireCandidateId).toBe("x");
    expect(statusOf("y")).toBe("archived");
  });

  it("does not disturb the pending hire when another candidate changes", async () => {
    await updateCandidate({ organizationId: ORG, candidateId: "y", notes: "Keep in touch" });

    expect(job().pendingHireCandidateId).toBe("x");
    expect(statusOf("y")).toBe("archived");
  });
});

describe("deleting the pending hire", () => {
  beforeEach(async () => {
    seedJob();
    seedCandidate("x", "shortlisted");
    seedCandidate("y", "interviewing");
    seedCandidate("z", "new");
    await hire("x");
  });

  it("clears the pending hire and restores the others", async () => {
    await expect(deleteCandidate(ORG, "x")).resolves.toBe(true);

    expectNoPendingHire();
    expect(statusOf("x")).toBeUndefined();
    expect(statusOf("y")).toBe("interviewing");
    expect(statusOf("z")).toBe("new");
  });

  it("leaves undo and finalize with nothing to act on", async () => {
    await deleteCandidate(ORG, "x");

    await expect(undoPendingHire(ORG, JOB)).rejects.toMatchObject({
      code: "NO_PENDING_HIRE",
      status: 400,
    });
    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({
      code: "NO_PENDING_HIRE",
    });
    expect(store.candidates).toHaveLength(2);
  });

  it("does not touch the pending hire when someone else is deleted", async () => {
    await deleteCandidate(ORG, "y");

    expect(job().pendingHireCandidateId).toBe("x");
    expect(statusOf("z")).toBe("archived");
  });
});

describe("a second hire on the same job", () => {
  beforeEach(async () => {
    seedJob();
    seedCandidate("alex", "hired");
    seedCandidate("dan", "interviewing");
    seedCandidate("eve", "shortlisted");
    await hire("dan");
  });

  it("never archives a candidate already hired", () => {
    expect(statusOf("alex")).toBe("hired");
    expect(statusOf("eve")).toBe("archived");
  });

  it("keeps the earlier hire through finalize", async () => {
    await expect(finalizePendingHire(ORG, JOB)).resolves.toBe(1);

    expect(statusOf("alex")).toBe("hired");
    expect(statusOf("dan")).toBe("hired");
    expect(statusOf("eve")).toBeUndefined();
  });

  it("keeps the earlier hire through undo", async () => {
    await expect(undoPendingHire(ORG, JOB)).resolves.toEqual({
      restoredCount: 1,
      revertedCandidateId: "dan",
    });

    expect(statusOf("alex")).toBe("hired");
    expect(statusOf("dan")).toBe("interviewing");
    expect(statusOf("eve")).toBe("shortlisted");
  });
});

describe("hires left archived before this fix", () => {
  function seedArchivedHire() {
    seedJob({
      pendingHireCandidateId: "dan",
      pendingHireExpiresAt: new Date(Date.now() + 60_000),
      pendingHirePreviousStatus: "interviewing",
    });
    seedCandidate("dan", "hired");
    seedCandidate("alex", "archived", { statusBeforeArchive: "hired" });
    seedCandidate("eve", "archived", { statusBeforeArchive: "new" });
  }

  it("finalize restores the earlier hire and removes only the others", async () => {
    seedArchivedHire();

    await expect(finalizePendingHire(ORG, JOB)).resolves.toBe(1);

    expect(statusOf("alex")).toBe("hired");
    expect(statusOf("eve")).toBeUndefined();
  });

  it("undo restores the earlier hire as hired", async () => {
    seedArchivedHire();

    await undoPendingHire(ORG, JOB);

    expect(statusOf("alex")).toBe("hired");
    expect(statusOf("eve")).toBe("new");
  });
});

describe("a job with many candidates", () => {
  beforeEach(async () => {
    seedJob();
    seedCandidate("dan", "interviewing");
    for (let index = 0; index < 60; index += 1) {
      seedCandidate(`person_${index}`, index % 2 === 0 ? "new" : "shortlisted");
    }
    vi.mocked(db.candidate.update).mockClear();
    await hire("dan");
  });

  it("archives everyone without a write that returns each resume", () => {
    expect(store.candidates.filter((row) => row.status === "archived")).toHaveLength(60);
    expect(statusOf("person_0")).toBe("archived");
    expect(db.candidate.update).toHaveBeenCalledTimes(1);
  });

  it("restores everyone without a write that returns each resume", async () => {
    vi.mocked(db.candidate.update).mockClear();

    await expect(undoPendingHire(ORG, JOB)).resolves.toMatchObject({ restoredCount: 60 });

    expect(statusOf("person_0")).toBe("new");
    expect(statusOf("person_1")).toBe("shortlisted");
    expect(db.candidate.update).not.toHaveBeenCalled();
  });
});

describe("the finalize guard", () => {
  function seedStalePending(status: string | null) {
    seedJob({
      pendingHireCandidateId: "x",
      pendingHireExpiresAt: new Date(Date.now() + 60_000),
      pendingHirePreviousStatus: "shortlisted",
    });
    if (status) seedCandidate("x", status);
    seedCandidate("y", "archived", { statusBeforeArchive: "interviewing" });
  }

  it("deletes nobody when the pending candidate is no longer hired", async () => {
    seedStalePending("interviewing");

    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({
      code: "NO_PENDING_HIRE",
    });

    expect(statusOf("y")).toBe("interviewing");
    expect(statusOf("x")).toBe("interviewing");
    expectNoPendingHire();
  });

  it("deletes nobody when the pending candidate is gone", async () => {
    seedStalePending(null);

    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({
      code: "NO_PENDING_HIRE",
    });

    expect(statusOf("y")).toBe("interviewing");
    expectNoPendingHire();
  });

  it("guards the expired sweep the same way", async () => {
    seedStalePending("interviewing");
    job().pendingHireExpiresAt = new Date(Date.now() - 60_000);

    await expect(processExpiredPendingHires({ organizationId: ORG })).resolves.toBe(0);

    expect(statusOf("y")).toBe("interviewing");
    expectNoPendingHire();
  });

  it("still removes archived candidates once a real hire expires", async () => {
    seedJob({
      pendingHireCandidateId: "x",
      pendingHireExpiresAt: new Date(Date.now() - 60_000),
      pendingHirePreviousStatus: "shortlisted",
    });
    seedCandidate("x", "hired");
    seedCandidate("y", "archived", { statusBeforeArchive: "interviewing" });

    await expect(processExpiredPendingHires({ organizationId: ORG })).resolves.toBe(1);

    expect(statusOf("x")).toBe("hired");
    expect(statusOf("y")).toBeUndefined();
    expectNoPendingHire();
  });

  it("undo repairs a stale pending hire without overwriting the chosen status", async () => {
    seedStalePending("rejected");

    await expect(undoPendingHire(ORG, JOB)).resolves.toEqual({
      restoredCount: 1,
      revertedCandidateId: "x",
    });

    expect(statusOf("x")).toBe("rejected");
    expect(statusOf("y")).toBe("interviewing");
    expectNoPendingHire();
  });

  it("undo no longer fails when the pending candidate is gone", async () => {
    seedStalePending(null);

    await undoPendingHire(ORG, JOB);

    expect(statusOf("y")).toBe("interviewing");
    expectNoPendingHire();
  });

  it("a real pending hire is reported until it is settled", async () => {
    seedJob();
    seedCandidate("x", "new");
    seedCandidate("y", "new");
    await hire("x");

    await expect(getPendingHireState(ORG, JOB)).resolves.toMatchObject({
      candidateId: "x",
      archivedCount: 1,
    });

    await expect(finalizePendingHire(ORG, JOB)).resolves.toBe(1);
    await expect(getPendingHireState(ORG, JOB)).resolves.toBeNull();
  });
});

describe("hire undo and finalize errors", () => {
  it("returns 404 for an unknown job", async () => {
    await expect(undoPendingHire(ORG, "missing")).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });
    await expect(finalizePendingHire(ORG, "missing")).rejects.toMatchObject({
      status: 404,
      code: "JOB_NOT_FOUND",
    });
  });

  it("returns 404 for a job in another workspace", async () => {
    seedJob({ organizationId: "org_2" });

    await expect(undoPendingHire(ORG, JOB)).rejects.toMatchObject({ status: 404 });
    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps 400 for a real job with nothing pending", async () => {
    seedJob();

    await expect(undoPendingHire(ORG, JOB)).rejects.toMatchObject({
      status: 400,
      code: "NO_PENDING_HIRE",
    });
    await expect(finalizePendingHire(ORG, JOB)).rejects.toMatchObject({
      status: 400,
      code: "NO_PENDING_HIRE",
    });
  });

  it("does not claim expired candidates were finalized while they still exist", async () => {
    seedJob({
      pendingHireCandidateId: "x",
      pendingHireExpiresAt: new Date(Date.now() - 60_000),
    });
    seedCandidate("x", "hired");
    seedCandidate("y", "archived", { statusBeforeArchive: "new" });

    const error = await undoPendingHire(ORG, JOB).catch((caught: Error) => caught);

    expect(error).toMatchObject({ status: 400, code: "HIRE_UNDO_EXPIRED" });
    expect((error as Error).message).not.toMatch(/finalized/i);
    expect(statusOf("y")).toBe("archived");
  });
});

describe("editing a job", () => {
  beforeEach(() => {
    seedJob();
    seedCandidate("x", "new");
    seedAnalysis("x");
  });

  it("keeps analyses for a title or client name edit", async () => {
    await updateJob(ORG, JOB, { ...jobInput, title: "Head of Support", clientName: "Atlas" });

    expect(job().title).toBe("Head of Support");
    expect(job().clientName).toBe("Atlas");
    expect(store.analyses).toHaveLength(1);
  });

  it("keeps analyses when nothing changed", async () => {
    await updateJob(ORG, JOB, jobInput);

    expect(store.analyses).toHaveLength(1);
  });

  it("treats a missing role type or level as the stored empty value", async () => {
    job().roleType = "";
    job().experienceLevel = "";

    await updateJob(ORG, JOB, { ...jobInput, roleType: null, experienceLevel: null });

    expect(store.analyses).toHaveLength(1);
  });

  it.each([
    ["description", { description: "A different role with different duties entirely." }],
    ["required skills", { requiredSkills: ["Zendesk", "Intercom"] }],
    ["preferred skills", { preferredSkills: [] }],
    ["experience level", { experienceLevel: "Junior" }],
    ["minimum years", { minYearsExperience: 2 }],
    ["education", { educationRequirements: ["BSc"] }],
    ["certifications", { certifications: ["ITIL"] }],
    ["role type", { roleType: "Contract" }],
  ])("clears analyses when %s changes", async (_field, change) => {
    await updateJob(ORG, JOB, { ...jobInput, ...change });

    expect(store.analyses).toHaveLength(0);
  });
});

describe("used resume screens", () => {
  const now = new Date("2026-11-15T12:00:00.000Z");
  const thisMonth = new Date("2026-11-02T12:00:00.000Z");
  const lastMonth = new Date("2026-10-30T12:00:00.000Z");

  beforeEach(() => {
    seedJob();
    seedCandidate("x", "new");
  });

  it("stays used after resume text is edited", async () => {
    seedAnalysis("x", thisMonth);
    seedScreenEvent(thisMonth);
    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(1);

    await updateCandidate({
      organizationId: ORG,
      candidateId: "x",
      rawText: "Updated resume text ".repeat(5),
    });

    expect(store.analyses).toHaveLength(0);
    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(1);
  });

  it("stays used after the candidate is deleted", async () => {
    seedAnalysis("x", thisMonth);
    seedScreenEvent(thisMonth);

    await deleteCandidate(ORG, "x");

    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(1);
  });

  it("counts a repeat screen of an edited resume as a second screen", async () => {
    seedAnalysis("x", thisMonth);
    seedScreenEvent(thisMonth);
    seedScreenEvent(thisMonth);

    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(2);
  });

  it("still counts analyses that have no audit event", async () => {
    seedAnalysis("x", thisMonth);

    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(1);
  });

  it("resets with the month and ignores other workspaces", async () => {
    seedAnalysis("x", lastMonth);
    seedScreenEvent(lastMonth);
    store.audit.push({
      id: "other",
      organizationId: "org_2",
      action: RESUME_SCREEN_AUDIT_ACTION,
      createdAt: thisMonth,
    });

    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(0);
  });

  it("ignores other audit events", async () => {
    store.audit.push({
      id: "edit",
      organizationId: ORG,
      action: "candidate.update_resume",
      createdAt: thisMonth,
    });

    await expect(countResumeScreensThisMonth(ORG, now)).resolves.toBe(0);
  });
});

describe("uploading a resume", () => {
  it("keeps the derived display name inside the 120 character limit", async () => {
    seedJob();

    const candidate = await createCandidateFromUpload({
      organizationId: ORG,
      jobId: JOB,
      fileName: `${"a".repeat(300)}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("not a real pdf"),
    });

    expect(candidate.displayName).toHaveLength(120);
    expect(candidate.fileName).toBe(`${"a".repeat(300)}.pdf`);
  });
});
