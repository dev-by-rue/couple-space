/**
 * Attached to requests after JwtAuthGuard succeeds.
 * appUserId === users.id === access JWT `sub`.
 * Keep this lean for authorization; profile fields live on GET /me.
 */
export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
};
