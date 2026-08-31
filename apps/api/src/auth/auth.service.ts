import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { users, type Db } from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import type { TokenPair } from "../token/token-pair.types.js";
import { TokenService } from "../token/token.service.js";
import type { LoginInput } from "./dto/login.schema.js";
import type { RegisterInput } from "./dto/register.schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { PublicUser } from "./public-user.types.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
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

    const passwordHash = await hashPassword(input.password);
    const created = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        dateOfBirth: input.dateOfBirth,
        emailVerified: false,
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
    const row = rows[0];

    // Same error whether missing user or bad password — reduces email enumeration.
    const ok = row && (await verifyPassword(row.passwordHash, input.password));
    if (!row || !ok) {
      throw new UnauthorizedException({ reason: "invalid_credentials" });
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
   * TEMPORARY: marks email verified and re-issues cookies/JWT.
   * Access tokens embed email_verified — without rotation, accept/invite
   * gates still see the pre-verify claim and return 403 email_unverified.
   */
  async devVerify(
    userId: string,
  ): Promise<TokenPair & { user: PublicUser }> {
    const updated = await this.db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    const row = updated[0]!;

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
