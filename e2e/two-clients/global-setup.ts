import { randomUUID } from "node:crypto";
import { Client as PgClient } from "pg";
import { assertTwoClientsEnv } from "../../tests/integration/env-guard";
import { CLIENTS } from "./clients";

/**
 * Starts each run from the same two empty workspaces on the local database.
 * Only rows with the suite's own `e2e-` slugs and `penaven-e2e-` emails are
 * touched.
 */
export default async function globalSetup() {
  assertTwoClientsEnv();

  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  try {
    const clients = Object.values(CLIENTS);
    const slugs = clients.map((client) => client.slug);
    const emails = clients.map((client) => client.ownerEmail);

    const tables = await pg.query<{ name: string | null }>(
      `SELECT to_regclass('public."Organization"')::text AS name`,
    );
    if (!tables.rows[0]?.name) {
      throw new Error(
        "The database has no tables. Run `npx prisma migrate deploy` against it first.",
      );
    }

    // Run log rows point at the workspace by id only, with no foreign key.
    await pg.query(
      `DELETE FROM "ExecutionRun" WHERE "workspaceId" IN
         (SELECT id FROM "Organization" WHERE slug = ANY($1))`,
      [slugs],
    );
    await pg.query(
      `DELETE FROM "ExecutionLogEntry" WHERE "workspaceId" IN
         (SELECT id FROM "Organization" WHERE slug = ANY($1))`,
      [slugs],
    );
    // Everything else cascades from the organization.
    await pg.query(`DELETE FROM "Organization" WHERE slug = ANY($1)`, [slugs]);
    await pg.query(`DELETE FROM "User" WHERE email = ANY($1)`, [emails]);

    // The bypass sign-in would create these as "Demo Company". Creating them
    // first gives each workspace its business name and fixed widget key. It
    // also avoids a race: the first dashboard page upserts the same user from
    // the layout and the page at once, and one of them hits the unique email.
    for (const client of clients) {
      const organizationId = `e2e_${randomUUID()}`;
      const userId = `e2e_${randomUUID()}`;
      await pg.query(
        `INSERT INTO "Organization"
           (id, name, slug, "widgetPublicKey", "widgetEnabled", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, true, now(), now())`,
        [organizationId, client.name, client.slug, client.widgetKey],
      );
      await pg.query(
        `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, now(), now())`,
        [userId, client.ownerEmail, `${client.name} owner`],
      );
      await pg.query(
        `INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role, "createdAt")
         VALUES ($1, $2, $3, 'ADMIN', now())`,
        [`e2e_${randomUUID()}`, organizationId, userId],
      );
    }
  } finally {
    await pg.end();
  }

  if (process.env.TWO_CLIENTS_CLERK === "1") {
    // A testing token lets the browser past Clerk's bot protection. `dotenv:
    // false`: the config already read the two keys, and nothing else from
    // `.env.local` may reach this process.
    const { clerkSetup } = await import("@clerk/testing/playwright");
    await clerkSetup({ dotenv: false });
  }
}
