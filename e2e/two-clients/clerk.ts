/**
 * Test users and organizations in the Clerk development instance, through the
 * Backend API. All of them are marked as test data: `+clerk_test` emails (which
 * accept the fixed code 424242 and never receive mail) and `penaven-e2e-` slugs.
 */
import { CLIENTS, type ClientId } from "./clients";

const API = "https://api.clerk.com/v1";

export const CLERK_TEST_USERS: Record<ClientId, { email: string; firstName: string; orgName: string; orgSlug: string }> = {
  clinic: {
    email: "penaven-e2e-clinic+clerk_test@example.com",
    firstName: "E2E Clinic Owner",
    orgName: `${CLIENTS.clinic.name} [e2e test]`,
    orgSlug: "penaven-e2e-clinic",
  },
  shop: {
    email: "penaven-e2e-shop+clerk_test@example.com",
    firstName: "E2E Shop Owner",
    orgName: `${CLIENTS.shop.name} [e2e test]`,
    orgSlug: "penaven-e2e-shop",
  },
};

export class ClerkUnavailable extends Error {}

function secretKey() {
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key) throw new ClerkUnavailable("CLERK_SECRET_KEY is not set.");
  if (!key.startsWith("sk_test_")) {
    throw new ClerkUnavailable("CLERK_SECRET_KEY is not a development (sk_test_) key.");
  }
  return key;
}

async function clerkApi<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

/** Null when organizations are on; otherwise Clerk's reason. */
export async function organizationsDisabledReason(): Promise<string | null> {
  const { status, body } = await clerkApi<{ errors?: Array<{ code: string; long_message?: string }> }>(
    "/organizations?limit=1",
  );
  if (status === 200) return null;
  const error = body?.errors?.[0];
  return `${error?.code ?? `HTTP ${status}`}: ${error?.long_message ?? "organizations are unavailable"}`;
}

type ClerkUser = { id: string };
type ClerkOrg = { id: string; slug: string };

export async function findOrCreateUser(id: ClientId): Promise<ClerkUser> {
  const user = CLERK_TEST_USERS[id];
  const found = await clerkApi<ClerkUser[]>(
    `/users?email_address=${encodeURIComponent(user.email)}`,
  );
  if (found.status === 200 && found.body.length > 0) return found.body[0];

  const createdUser = await clerkApi<ClerkUser>("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [user.email],
      first_name: user.firstName,
      skip_password_requirement: true,
      public_metadata: { penavenE2eTestData: true },
    }),
  });
  if (createdUser.status !== 200) {
    throw new Error(`Could not create Clerk test user ${user.email}: HTTP ${createdUser.status} ${JSON.stringify(createdUser.body)}`);
  }
  return createdUser.body;
}

/** The user's own organization, with the user as admin. Requires organizations to be on. */
export async function findOrCreateOrganization(id: ClientId, userId: string): Promise<ClerkOrg> {
  const spec = CLERK_TEST_USERS[id];
  const found = await clerkApi<ClerkOrg>(`/organizations/${encodeURIComponent(spec.orgSlug)}`);
  let organization = found.status === 200 ? found.body : null;

  if (!organization) {
    const createdOrg = await clerkApi<ClerkOrg>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: spec.orgName,
        slug: spec.orgSlug,
        created_by: userId,
        public_metadata: { penavenE2eTestData: true },
      }),
    });
    if (createdOrg.status !== 200) {
      throw new Error(`Could not create Clerk test organization ${spec.orgSlug}: HTTP ${createdOrg.status}`);
    }
    organization = createdOrg.body;
  }

  // created_by makes the creator an admin; this covers an organization made earlier.
  const membership = await clerkApi(`/organizations/${organization.id}/memberships`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role: "org:admin" }),
  });
  if (membership.status !== 200 && membership.status !== 422 && membership.status !== 400) {
    throw new Error(`Could not add the test user to ${spec.orgSlug}: HTTP ${membership.status}`);
  }

  return organization;
}
