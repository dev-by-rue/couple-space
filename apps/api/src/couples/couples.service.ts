import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, eq, gte } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  canAcceptInvitation,
  canActivateCouple,
} from "@couple-space/domain";
import {
  auditEvents,
  coupleInvitations,
  coupleMemberships,
  couples,
  users,
  type Db,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { loadEnv } from "../config/env.js";
import type { AuthUser } from "../auth/auth-user.types.js";
import type { CreateInvitationInput } from "./dto/create-invitation.schema.js";

@Injectable()
export class CouplesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async createCouple(user: AuthUser) {
    const existing = await this.db
      .select()
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.userId, user.id),
          eq(coupleMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (existing[0]) {
      throw new ConflictException({ reason: "already_in_couple" });
    }

    const result = await this.db.transaction(async (tx) => {
      const [couple] = await tx
        .insert(couples)
        .values({ status: "forming" })
        .returning();

      await tx.insert(coupleMemberships).values({
        coupleId: couple.id,
        userId: user.id,
        status: "active",
      });

      await tx.insert(auditEvents).values({
        actorUserId: user.id,
        action: "couple.created",
        entityType: "couple",
        entityId: couple.id,
      });

      return couple;
    });

    return { coupleId: result.id, status: result.status };
  }

  async getMyCouple(user: AuthUser) {
    const membership = await this.db
      .select()
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.userId, user.id),
          eq(coupleMemberships.status, "active"),
        ),
      )
      .limit(1);

    const mine = membership[0];
    if (!mine) {
      throw new NotFoundException({ reason: "no_couple" });
    }

    const [couple] = await this.db
      .select()
      .from(couples)
      .where(eq(couples.id, mine.coupleId))
      .limit(1);

    const members = await this.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        membershipStatus: coupleMemberships.status,
      })
      .from(coupleMemberships)
      .innerJoin(users, eq(users.id, coupleMemberships.userId))
      .where(
        and(
          eq(coupleMemberships.coupleId, mine.coupleId),
          eq(coupleMemberships.status, "active"),
        ),
      );

    return {
      coupleId: couple.id,
      status: couple.status,
      members,
    };
  }

  async createInvitation(user: AuthUser, coupleId: string, input: CreateInvitationInput) {
    const env = loadEnv();

    const membership = await this.db
      .select()
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.coupleId, coupleId),
          eq(coupleMemberships.userId, user.id),
          eq(coupleMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!membership[0]) {
      throw new ForbiddenException({ reason: "not_a_member" });
    }

    const [couple] = await this.db
      .select()
      .from(couples)
      .where(eq(couples.id, coupleId))
      .limit(1);

    if (!couple || (couple.status !== "forming" && couple.status !== "active")) {
      throw new ForbiddenException({ reason: "couple_not_invitable" });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [{ value: inviteCount }] = await this.db
      .select({ value: count() })
      .from(coupleInvitations)
      .where(
        and(
          eq(coupleInvitations.invitedByUserId, user.id),
          gte(coupleInvitations.createdAt, since),
        ),
      );

    if (Number(inviteCount) >= env.INVITE_RATE_LIMIT_PER_HOUR) {
      throw new HttpException({ reason: "rate_limited" }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + env.INVITE_TTL_HOURS * 60 * 60 * 1000,
    );

    const [invitation] = await this.db
      .insert(coupleInvitations)
      .values({
        coupleId,
        invitedByUserId: user.id,
        email: input.email,
        token,
        status: "pending",
        expiresAt,
      })
      .returning();

    await this.db.insert(auditEvents).values({
      actorUserId: user.id,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { coupleId, inviteeEmail: input.email },
    });

    return { token: invitation.token, expiresAt: invitation.expiresAt };
  }

  async acceptInvitation(user: AuthUser, token: string) {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(coupleInvitations)
        .where(eq(coupleInvitations.token, token))
        .limit(1);

      const invitation = rows[0];
      if (!invitation) {
        throw new NotFoundException({ reason: "invite_not_found" });
      }

      // Idempotent: same user already accepted this invite.
      if (
        invitation.status === "accepted" &&
        invitation.email.trim().toLowerCase() === user.email.trim().toLowerCase()
      ) {
        const [couple] = await tx
          .select()
          .from(couples)
          .where(eq(couples.id, invitation.coupleId))
          .limit(1);
        return { coupleId: couple.id, status: couple.status };
      }

      const activeElsewhere = await tx
        .select()
        .from(coupleMemberships)
        .where(
          and(
            eq(coupleMemberships.userId, user.id),
            eq(coupleMemberships.status, "active"),
          ),
        )
        .limit(1);

      const gate = canAcceptInvitation({
        invitationStatus: invitation.status as
          | "pending"
          | "accepted"
          | "revoked"
          | "expired",
        invitationExpiresAt: invitation.expiresAt,
        now: new Date(),
        inviteeEmailVerified: user.emailVerified,
        inviteeHasActiveMembership: Boolean(activeElsewhere[0]),
        invitationEmail: invitation.email,
        inviteeEmail: user.email,
      });

      if (!gate.ok) {
        if (gate.reason === "email_unverified" || gate.reason === "email_mismatch") {
          throw new ForbiddenException({ reason: gate.reason });
        }
        if (gate.reason === "already_in_couple") {
          throw new ConflictException({ reason: gate.reason });
        }
        if (gate.reason === "expired") {
          throw new GoneException({ reason: gate.reason });
        }
        throw new ConflictException({ reason: gate.reason });
      }

      await tx
        .update(coupleInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(coupleInvitations.id, invitation.id));

      await tx.insert(coupleMemberships).values({
        coupleId: invitation.coupleId,
        userId: user.id,
        status: "active",
      });

      await tx.insert(auditEvents).values({
        actorUserId: user.id,
        action: "invitation.accepted",
        entityType: "invitation",
        entityId: invitation.id,
        metadata: { coupleId: invitation.coupleId },
      });

      const activeMembers = await tx
        .select({
          emailVerified: users.emailVerified,
        })
        .from(coupleMemberships)
        .innerJoin(users, eq(users.id, coupleMemberships.userId))
        .where(
          and(
            eq(coupleMemberships.coupleId, invitation.coupleId),
            eq(coupleMemberships.status, "active"),
          ),
        );

      const [couple] = await tx
        .select()
        .from(couples)
        .where(eq(couples.id, invitation.coupleId))
        .limit(1);

      const activate = canActivateCouple({
        coupleStatus: couple.status as
          | "forming"
          | "active"
          | "dissolving"
          | "dissolved",
        activeMemberships: activeMembers.map((m) => ({
          emailVerified: m.emailVerified,
        })),
      });

      let status = couple.status;
      if (activate.ok) {
        const [updated] = await tx
          .update(couples)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(couples.id, couple.id))
          .returning();
        status = updated.status;

        await tx.insert(auditEvents).values({
          actorUserId: user.id,
          action: "couple.activated",
          entityType: "couple",
          entityId: couple.id,
        });
      }

      return { coupleId: couple.id, status };
    });
  }

  async revokeInvitation(user: AuthUser, token: string) {
    const [invitation] = await this.db
      .select()
      .from(coupleInvitations)
      .where(eq(coupleInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new NotFoundException({ reason: "invite_not_found" });
    }

    if (invitation.invitedByUserId !== user.id) {
      throw new ForbiddenException({ reason: "not_inviter" });
    }

    if (invitation.status !== "pending") {
      throw new ConflictException({ reason: "not_pending" });
    }

    await this.db
      .update(coupleInvitations)
      .set({ status: "revoked" })
      .where(eq(coupleInvitations.id, invitation.id));

    await this.db.insert(auditEvents).values({
      actorUserId: user.id,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: invitation.id,
    });

    return { ok: true };
  }
}
