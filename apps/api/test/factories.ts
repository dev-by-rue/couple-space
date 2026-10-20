import { AuthUser } from "../src/auth/auth-user.types.js";

export function queryResult<T>(rows: T[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: T[]) => void, reject?: (reason: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };

  for (const method of ["from", "where", "innerJoin", "orderBy", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "an@example.com",
    emailVerified: true,
    ...overrides,
  };
}

export function makeMembership(overrides = {}) {
  return {
    id: "m1",
    coupleId: "couple-1",
    userId: "user-1",
    status: "active",
    ...overrides,
  };
}

export function makeMember(overrides = {}) {
  return {
    userId: "user-1",
    email: "a@example.com",
    displayName: "TestName",
    emailVerified: true,
    membershipStatus: "active",
    ...overrides,
  };
}
export function makeInvitation(overrides = {}) {
  return {
    email: "partner@example.com",
    expiresAt: new Date("2026-11-01T00:00:00Z"),
    token: "invite-token",
    ...overrides,
  };
}
