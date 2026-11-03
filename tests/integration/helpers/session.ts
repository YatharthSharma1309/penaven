export type Actor = {
  userId: string;
  email: string;
  orgId: string;
  orgRole: "org:admin" | "org:member";
};

let actor: Actor | null = null;

/** Chooses who the mocked Clerk session says is calling. */
export function actAs(next: Actor | null) {
  actor = next;
}

export async function clerkAuth() {
  return {
    userId: actor?.userId ?? null,
    orgId: actor?.orgId ?? null,
    orgRole: actor?.orgRole ?? null,
  };
}

export async function clerkCurrentUser() {
  if (!actor) return null;

  return {
    id: actor.userId,
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: actor.email }],
    firstName: "Test",
    lastName: actor.orgRole === "org:admin" ? "Admin" : "Agent",
    imageUrl: "",
  };
}
