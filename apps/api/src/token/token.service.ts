import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../db/db.module.js';
import { refreshTokens, users, type Db } from '@couple-space/database';
import { Env, loadEnv } from '../config/env.js';
import { AuthUser } from '../auth/auth-user.types.js';
import { jwtVerify, SignJWT } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { TokenPair } from './token-pair.types.js';

/**
 * Fast one-way hash for refresh-token lookup.
 * Refresh tokens are high-entropy random bytes, so SHA-256 is fine here.
 * (Passwords use argon2id instead — never hash passwords with SHA-256.)
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class TokenService {
  private env: Env = loadEnv();
  private secret: Uint8Array = new TextEncoder().encode(this.env.JWT_SECRET);

  constructor(@Inject(DB) private readonly db: Db) {}

  async issueTokenPair(user: AuthUser): Promise<TokenPair> {
    // Access token is a short-lived JWT. `sub` MUST be users.id.
    const accessToken = await new SignJWT({
      email: user.email,
      email_verified: user.emailVerified,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);

    // Opaque refresh token (not a JWT) so we can revoke it in Postgres.
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(accessToken, this.secret);
    if (!payload.sub || typeof payload.email !== 'string') {
      throw new Error('invalid_access_token');
    }
    return {
      id: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
    };
  }

  /**
   * Rotate: revoke the presented refresh, then issue a brand-new pair.
   * Limits damage if a refresh token is stolen and replayed later.
   */
  async rotateRefresh(
    rawRefresh: string,
  ): Promise<TokenPair & { userId: string }> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || !row.userId || row.expiresAt.getTime() <= Date.now()) {
      throw new Error('invalid_refresh');
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    const userRows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      throw new Error('invalid_refresh');
    }

    const pair = await this.issueTokenPair({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
    return { ...pair, userId: user.id };
  }

  async revokeRefresh(rawRefresh: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(rawRefresh)));
  }
}
