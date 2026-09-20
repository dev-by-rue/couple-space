import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, isNull } from "drizzle-orm";
import {
  emailVerificationTokens,
  users,
  type Db,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { MAIL, type MailPort } from "../mail/mail.port.js";
import { Env, loadEnv } from "../config/env.js";

/**
 * Domain error for bad verify tokens. AuthService maps this to
 * `BadRequestException({ reason: 'invalid_or_expired_token' })` at the HTTP layer.
 */
export class InvalidOrExpiredTokenError extends Error {
  readonly reason = "invalid_or_expired_token" as const;

  constructor() {
    super("invalid_or_expired_token");
    this.name = "InvalidOrExpiredTokenError";
  }
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class EmailVerificationService {
  private env: Env = loadEnv();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MAIL) private readonly mail: MailPort,
  ) {}

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.env.EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000,
    );

    const link = `${this.env.WEB_ORIGIN}/verify-email?token=${encodeURIComponent(rawToken)}`;

    // Send first so SMTP failure leaves any prior unused token intact.
    await this.mail.sendMail({
      to: email,
      subject: "Verify your email",
      text: `Verify your email by opening this link:\n\n${link}`,
      html: `<p>Verify your email by opening this link:</p><p><a href="${link}">${link}</a></p>`,
    });

    const now = new Date();

    // Only one active link per user: invalidate prior unused tokens on resend/register.
    await this.db
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      );

    // Hash-only storage: a DB leak must not allow replay without the raw token from the email.
    await this.db.insert(emailVerificationTokens).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });
  }

  async consumeToken(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = hashToken(rawToken);
    const rows = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    if (
      !row ||
      row.usedAt != null ||
      row.expiresAt.getTime() <= Date.now()
    ) {
      throw new InvalidOrExpiredTokenError();
    }

    await this.db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, row.id));

    return { userId: row.userId };
  }

  /**
   * Atomically validates the token, marks the user verified, and burns the token.
   * Rolls back if the user row is missing so the link remains usable.
   */
  async consumeAndVerifyUser(rawToken: string): Promise<{
    id: string;
    email: string;
    emailVerified: boolean;
    displayName: string;
    dateOfBirth: string;
  }> {
    const tokenHash = hashToken(rawToken);

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, tokenHash))
        .limit(1);

      const row = rows[0];
      if (
        !row ||
        row.usedAt != null ||
        row.expiresAt.getTime() <= Date.now()
      ) {
        throw new InvalidOrExpiredTokenError();
      }

      const updated = await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, row.userId))
        .returning();

      const user = updated[0];
      if (!user) {
        throw new InvalidOrExpiredTokenError();
      }

      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, row.id));

      return user;
    });
  }

  async countRecentResends(userId: string): Promise<number> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          gte(emailVerificationTokens.createdAt, since),
        ),
      );
    return rows.length;
  }
}
