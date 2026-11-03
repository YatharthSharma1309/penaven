import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isUniqueConstraintError } from "@/lib/api/prisma-errors";
import { db } from "@/lib/db";
import type { MemberRole, Organization, User } from "@/generated/prisma/client";
import { isAuthBypassEnabled } from "./bypass";
import {
  ensureUniqueOrgSlug,
  generateWidgetPublicKey,
  getDemoOrganizationContext,
  slugifyOrgName,
} from "@/lib/auth/demo";

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ORG" | "ACCOUNT_CONFLICT",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type OrgMembershipContext = {
  organization: Organization;
  user: User;
  role: MemberRole;
};

function mapClerkRole(role: string | undefined): MemberRole {
  if (role === "org:admin" || role === "admin") return "ADMIN";
  return "AGENT";
}

async function syncUserFromClerk(clerkUserId: string) {
  const clerkUser = await currentUser();

  if (!clerkUser || clerkUser.id !== clerkUserId) {
    return db.user.findUnique({ where: { clerkUserId } });
  }

  const email =
    clerkUser.emailAddresses.find(
      (address) => address.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new AuthError("Clerk user is missing an email address.", "UNAUTHORIZED");
  }

  try {
    return await db.user.upsert({
      where: { clerkUserId },
      create: {
        clerkUserId,
        email,
        name:
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          email.split("@")[0],
        imageUrl: clerkUser.imageUrl,
      },
      update: {
        email,
        name:
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          email.split("@")[0],
        imageUrl: clerkUser.imageUrl,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // Either two first requests raced, or this email is on another user's row.
    const existing = await db.user.findUnique({ where: { clerkUserId } });
    if (existing) {
      console.warn("User sync skipped after a unique clash.", {
        code: "P2002",
        model: "User",
      });
      return existing;
    }

    // Not relinked by email: that would hand the old row's workspaces to a
    // different Clerk account.
    console.error("New user blocked by an email already in use.", {
      code: "P2002",
      model: "User",
    });
    throw new AuthError(
      "This email is already linked to another account. Contact support to restore access.",
      "ACCOUNT_CONFLICT",
    );
  }
}

async function syncOrganizationFromClerk(clerkOrgId: string) {
  const existing = await db.organization.findUnique({ where: { clerkOrgId } });
  if (existing) return existing;

  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const clerkOrg = await client.organizations.getOrganization({
    organizationId: clerkOrgId,
  });

  const baseSlug = slugifyOrgName(clerkOrg.name);
  const createOrganization = async () =>
    db.organization.create({
      data: {
        clerkOrgId,
        name: clerkOrg.name,
        slug: await ensureUniqueOrgSlug(baseSlug),
        widgetPublicKey: generateWidgetPublicKey(),
        widgetEnabled: true,
      },
    });

  try {
    return await createOrganization();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // A parallel request or the Clerk webhook may have just created this org.
    const raced = await db.organization.findUnique({ where: { clerkOrgId } });
    if (raced) return raced;

    // Otherwise another org took the slug between the check and the create.
    return createOrganization();
  }
}

async function syncMembership(
  organizationId: string,
  userId: string,
  role: MemberRole,
) {
  return db.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    create: { organizationId, userId, role },
    update: { role },
  });
}

export async function getOrgMembershipContext(): Promise<OrgMembershipContext | null> {
  if (isAuthBypassEnabled()) {
    const { organization, user } = await getDemoOrganizationContext();
    return { organization, user, role: "ADMIN" };
  }

  const session = await auth();
  const clerkUserId = session.userId;
  const clerkOrgId = session.orgId;

  if (!clerkUserId) return null;
  if (!clerkOrgId) return null;

  const user = await syncUserFromClerk(clerkUserId);
  if (!user) {
    throw new AuthError("User account not found.", "UNAUTHORIZED");
  }
  const organization = await syncOrganizationFromClerk(clerkOrgId);
  const orgWithKey =
    organization.widgetPublicKey
      ? organization
      : await db.organization.update({
          where: { id: organization.id },
          data: { widgetPublicKey: generateWidgetPublicKey() },
        });
  const membership = await syncMembership(
    organization.id,
    user.id,
    mapClerkRole(session.orgRole ?? undefined),
  );

  return {
    organization: orgWithKey,
    user,
    role: membership.role,
  };
}

export async function requireOrgMembership(
  minimumRole?: MemberRole,
): Promise<OrgMembershipContext> {
  const context = await getOrgMembershipContext();

  if (!context) {
    throw new AuthError("Authentication required.", "UNAUTHORIZED");
  }

  if (minimumRole === "ADMIN" && context.role !== "ADMIN") {
    throw new AuthError("Admin access required.", "FORBIDDEN");
  }

  return context;
}

export async function requireOrgMembershipOrRedirect(
  minimumRole?: MemberRole,
): Promise<OrgMembershipContext> {
  if (!isAuthBypassEnabled()) {
    const session = await auth();
    if (!session.userId) redirect("/sign-in");
    if (!session.orgId) redirect("/onboarding");
  }

  try {
    return await requireOrgMembership(minimumRole);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "UNAUTHORIZED" || error.code === "NO_ORG") {
        redirect("/sign-in");
      }
      if (error.code === "FORBIDDEN") {
        redirect("/dashboard");
      }
    }
    throw error;
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    const status =
      error.code === "UNAUTHORIZED"
        ? 401
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "ACCOUNT_CONFLICT"
            ? 409
            : 400;
    return Response.json({ error: error.message }, { status });
  }

  return null;
}
