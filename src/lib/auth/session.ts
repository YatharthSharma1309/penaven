import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { MemberRole, Organization, User } from "@/generated/prisma/client";
import { isAuthBypassEnabled } from "./bypass";
import { isPublicDemoMode } from "@/lib/env/public-demo";
import {
  ensureUniqueOrgSlug,
  generateWidgetPublicKey,
  getDemoOrganizationContext,
  slugifyOrgName,
} from "@/lib/auth/demo";

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ORG",
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

  return db.user.upsert({
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
  const slug = await ensureUniqueOrgSlug(baseSlug);

  return db.organization.create({
    data: {
      clerkOrgId,
      name: clerkOrg.name,
      slug,
      widgetPublicKey: generateWidgetPublicKey(),
      widgetEnabled: true,
    },
  });
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
    // Demo visitors are anonymous, so they never get the admin screens or routes.
    return { organization, user, role: isPublicDemoMode() ? "AGENT" : "ADMIN" };
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
          : 400;
    return Response.json({ error: error.message }, { status });
  }

  return null;
}
