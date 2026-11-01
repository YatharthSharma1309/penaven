import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Runs the real role cap and share token code against a fake with a yield
 * between every read and write, as parallel database calls have. The fake's
 * advisory lock and conditional update behave like Postgres's, so taking the
 * lock late or writing without the condition fails these tests.
 */

const store = vi.hoisted(() => ({
  jobs: [] as Array<{ id: string; organizationId: string; shareToken: string | null }>,
  lockSql: [] as string[],
  lockKeys: [] as unknown[],
  held: new Map<string, Promise<void>>(),
}));

vi.mock("@/lib/db", () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  const job = {
    count: vi.fn(async ({ where }: { where: { organizationId: string } }) => {
      await tick();
      return store.jobs.filter((row) => row.organizationId === where.organizationId)
        .length;
    }),
    create: vi.fn(async ({ data }: { data: { organizationId: string } }) => {
      await tick();
      const row = {
        id: `job_${store.jobs.length + 1}`,
        shareToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        requiredSkills: "[]",
        ...data,
      };
      store.jobs.push(row);
      return row;
    }),
    findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
      await tick();
      const row = store.jobs.find((item) => item.id === where.id);
      return row ? { ...row } : null;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; shareToken: string | null };
        data: { shareToken: string };
      }) => {
        await tick();
        // The check and the write are one step, as in a single UPDATE.
        const row = store.jobs.find(
          (item) => item.id === where.id && item.shareToken === where.shareToken,
        );
        if (!row) return { count: 0 };
        row.shareToken = data.shareToken;
        return { count: 1 };
      },
    ),
  };

  return {
    db: {
      job,
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => {
        let release = () => {};
        const tx = {
          job,
          $executeRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
            store.lockSql.push(sql.join("?"));
            store.lockKeys.push(values[0]);
            const key = String(values[0]);
            while (store.held.has(key)) await store.held.get(key);
            store.held.set(
              key,
              new Promise<void>((resolve) => {
                release = () => {
                  store.held.delete(key);
                  resolve();
                };
              }),
            );
            return 1;
          },
        };
        try {
          return await work(tx);
        } finally {
          release();
        }
      }),
    },
  };
});

import { PLANS } from "@/lib/billing/plans";
import { createJobWithinCap } from "./jobs";
import { ensureShareToken } from "./shortlist";

const jobInput = {
  title: "Support lead",
  description: "Runs support",
  requiredSkills: [],
  preferredSkills: [],
  educationRequirements: [],
  certifications: [],
  minYearsExperience: null,
  experienceLevel: "",
  roleType: "",
};

beforeEach(() => {
  store.jobs = [];
  store.lockSql = [];
  store.lockKeys = [];
  store.held.clear();
});

describe("createJobWithinCap", () => {
  it("creates one job from 8 parallel requests on Free", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createJobWithinCap("org_1", jobInput)),
    );

    expect(store.jobs).toHaveLength(PLANS.free.roles);
    expect(results.filter(Boolean)).toHaveLength(PLANS.free.roles);
    expect(results.filter((job) => job === null)).toHaveLength(8 - PLANS.free.roles);
  });

  it("takes a transaction-scoped lock for that workspace only", async () => {
    await Promise.all([
      createJobWithinCap("org_1", jobInput),
      createJobWithinCap("org_2", jobInput),
    ]);

    expect(store.lockSql[0]).toContain("pg_advisory_xact_lock");
    expect(store.lockKeys).toEqual(
      expect.arrayContaining(["role-cap:org_1", "role-cap:org_2"]),
    );
    expect(store.jobs).toHaveLength(2);
  });

  it("returns null once the workspace is at the cap", async () => {
    store.jobs = [{ id: "job_0", organizationId: "org_1", shareToken: null }];
    expect(await createJobWithinCap("org_1", jobInput)).toBeNull();
    expect(store.jobs).toHaveLength(1);
  });
});

describe("ensureShareToken", () => {
  beforeEach(() => {
    store.jobs = [{ id: "job_1", organizationId: "org_1", shareToken: null }];
  });

  it("gives every parallel caller the one stored token", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => ensureShareToken("org_1", "job_1")),
    );

    const stored = store.jobs[0].shareToken;
    expect(stored).toBeTruthy();
    expect(new Set(results.map((result) => result?.token))).toEqual(new Set([stored]));
    expect(results.filter((result) => result?.created)).toHaveLength(1);
  });

  it("returns an existing token without writing", async () => {
    store.jobs[0].shareToken = "existing";
    expect(await ensureShareToken("org_1", "job_1")).toEqual({
      token: "existing",
      created: false,
    });
  });

  it("returns null for a job that does not exist", async () => {
    expect(await ensureShareToken("org_1", "missing")).toBeNull();
  });
});
