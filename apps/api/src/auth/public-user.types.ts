/**
 * Safe user fields returned from auth endpoints.
 * Never include passwordHash.
 */
export type PublicUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  dateOfBirth: string;
};
