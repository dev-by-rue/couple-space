import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { loadEnv } from "../config/env.js";
import type { TokenPair } from "../token/token-pair.types.js";
import { TokenService } from "../token/token.service.js";
import type { LoginInput } from "./dto/login.schema.js";
import type { RegisterInput } from "./dto/register.schema.js";
import {
  EmailVerificationService,
  InvalidOrExpiredTokenError,
} from "./email-verification.service.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { PublicUser } from "./public-user.types.js";
import { ChangePasswordInput } from "@couple-space/domain";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async register(
    input: RegisterInput,
  ): Promise<TokenPair & { user: PublicUser }> {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing[0]) {
      // Stable machine-readable reason for clients.
      throw new ConflictException({ reason: "email_taken" });
    }

    const autoVerify = loadEnv().SANDBOX_AUTO_VERIFY;
    const passwordHash = await hashPassword(input.password);
    const created = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        dateOfBirth: input.dateOfBirth,
        emailVerified: autoVerify,
      })
      .returning();

    const row = created[0]!;
    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.register",
      entityType: "user",
      entityId: row.id,
    });

    try {
      if (autoVerify) return { ...pair, user: toPublicUser(row) };
      await this.emailVerification.sendVerificationEmail(row.id, row.email);
    } catch {
      // Account is already committed; SMTP failure must not roll back registration.
      // Client can resend from /check-email once mail is reachable.
    }

    return {
      ...pair,
      user: toPublicUser(row),
    };
  }

  async login(input: LoginInput): Promise<TokenPair & { user: PublicUser }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    let row = rows[0];

    // Same error whether missing user or bad password — reduces email enumeration.
    const ok = row && (await verifyPassword(row.passwordHash, input.password));
    if (!row || !ok) {
      throw new UnauthorizedException({ reason: "invalid_credentials" });
    }

    if (!row.emailVerified && loadEnv().SANDBOX_AUTO_VERIFY) {
      row = await this.markEmailVerified(row.id);
    }

    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.login",
      entityType: "user",
      entityId: row.id,
    });

    return {
      ...pair,
      user: toPublicUser(row),
    };
  }

  async refresh(rawRefresh: string): Promise<TokenPair & { user: PublicUser }> {
    try {
      const rotated = await this.tokens.rotateRefresh(rawRefresh);
      const rows = await this.db
        .select()
        .from(users)
        .where(eq(users.id, rotated.userId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new UnauthorizedException({ reason: "invalid_refresh" });
      }
      return {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        user: toPublicUser(row),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({ reason: "invalid_refresh" });
    }
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (rawRefresh) {
      await this.tokens.revokeRefresh(rawRefresh);
    }
  }

  /**
   *
   * @param userId
   * @param input
   * @returns
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<TokenPair & { user: PublicUser }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const row = rows[0];
    if (!row)
      throw new UnauthorizedException({ reason: "invalid_credentials" });

    const ok = await verifyPassword(row.passwordHash, input.currentPassword);
    if (!ok) {
      throw new BadRequestException({ reason: "invalid_current_password" });
    }

    const passwordHash = await hashPassword(input.newPassword);

    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.tokens.revokeAllForUser(userId);

    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: userId,
      action: "auth.change_password",
      entityType: "user",
      entityId: userId,
    });

    return { ...pair, user: toPublicUser(row) };
  }

  async verifyEmail(
    rawToken: string,
  ): Promise<TokenPair & { user: PublicUser }> {
    let row;
    try {
      row = await this.emailVerification.consumeAndVerifyUser(rawToken);
    } catch (error) {
      if (error instanceof InvalidOrExpiredTokenError) {
        throw new BadRequestException({ reason: "invalid_or_expired_token" });
      }
      throw error;
    }

    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: row.id,
      action: "auth.verify_email",
      entityType: "user",
      entityId: row.id,
    });

    return {
      ...pair,
      user: toPublicUser(row),
    };
  }

  async resendVerification(
    userId: string,
  ): Promise<{ ok: true; alreadyVerified?: true; sent?: false }> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new UnauthorizedException({ reason: "invalid_credentials" });
    }

    if (row.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    const env = loadEnv();

    if (env.SANDBOX_AUTO_VERIFY) {
      await this.markEmailVerified(userId);
      return { ok: true, alreadyVerified: true };
    }
    const recentCount = await this.emailVerification.countRecentResends(userId);
    if (recentCount >= env.EMAIL_VERIFY_RESEND_PER_HOUR) {
      throw new HttpException(
        { reason: "resend_rate_limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      await this.emailVerification.sendVerificationEmail(userId, row.email);
    } catch {
      // User exists and is unverified; SMTP failure must not block retry.
      return { ok: true, sent: false };
    }

    await this.audit.append({
      actorUserId: userId,
      action: "auth.resend_verification",
      entityType: "user",
      entityId: userId,
    });

    return { ok: true };
  }

  /**
   * TEMPORARY escape hatch alongside POST /auth/verify-email.
   * Marks email verified and re-issues cookies/JWT.
   * Access tokens embed email_verified — without rotation, accept/invite
   * gates still see the pre-verify claim and return 403 email_unverified.
   */
  async devVerify(userId: string): Promise<TokenPair & { user: PublicUser }> {
    const row = await this.markEmailVerified(userId);

    const pair = await this.tokens.issueTokenPair({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
    });

    await this.audit.append({
      actorUserId: userId,
      action: "auth.dev_verify",
      entityType: "user",
      entityId: userId,
    });

    return {
      ...pair,
      user: toPublicUser(row),
    };
  }

  private async markEmailVerified(userId: string) {
    const updated = await this.db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated[0];
  }
}

function toPublicUser(row: {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  dateOfBirth: string;
}): PublicUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    displayName: row.displayName,
    dateOfBirth: row.dateOfBirth,
  };
}
