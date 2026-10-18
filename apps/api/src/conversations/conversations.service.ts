import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { isSessionOpen, sessionViewerPhase } from "@couple-space/domain";
import {
  conversationSessions,
  coupleMemberships,
  couples,
  promptThemes,
  prompts,
  sessionResponses,
  sessionReveals,
  users,
  type Db,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import type { AuthUser } from "../auth/auth-user.types.js";
import type { CreateSessionInput } from "./dto/create-session.schema.js";
import type { SubmitResponseInput } from "./dto/submit-response.schema.js";
import {
  buildSessionDetailDto,
  type SessionDetailDto,
} from "./session-detail.mapper.js";
import type { SaveDraftInput } from "./dto/save-draft.schema.js";

@Injectable()
export class ConversationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listThemes(_user: AuthUser) {
    const themes = await this.db
      .select()
      .from(promptThemes)
      .orderBy(asc(promptThemes.sortOrder), asc(promptThemes.title));

    const allPrompts = await this.db
      .select()
      .from(prompts)
      .where(eq(prompts.kind, "curated"))
      .orderBy(asc(prompts.sortOrder), asc(prompts.title));

    return {
      themes: themes.map((theme) => ({
        id: theme.id,
        slug: theme.slug,
        title: theme.title,
        description: theme.description,
        symbol: theme.symbol,
        prompts: allPrompts
          .filter((p) => p.themeId === theme.id)
          .map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            text: p.text,
          })),
      })),
    };
  }

  async saveDraft(
    user: AuthUser,
    sessionId: string,
    input: SaveDraftInput,
  ): Promise<void> {
    await this.requireSessionMember(user, sessionId);

    const [existing] = await this.db
      .select()
      .from(sessionResponses)
      .where(
        and(
          eq(sessionResponses.sessionId, sessionId),
          eq(sessionResponses.userId, user.id),
        ),
      );

    if (!existing)
      throw new NotFoundException({ reason: "response_row_missing" });
    if (existing.submittedAt != null)
      throw new ConflictException({ reason: "already_submitted" });

    await this.db
      .update(sessionResponses)
      .set({ body: input.text, updatedAt: new Date() })
      .where(eq(sessionResponses.id, existing.id));
  }

  async listSessions(user: AuthUser) {
    const ctx = await this.requireMembership(user);

    const rows = await this.db
      .select({
        id: conversationSessions.id,
        updatedAt: conversationSessions.updatedAt,
        promptTitle: prompts.title,
        promptText: prompts.text,
      })
      .from(conversationSessions)
      .innerJoin(prompts, eq(prompts.id, conversationSessions.promptId))
      .where(eq(conversationSessions.coupleId, ctx.coupleId))
      .orderBy(asc(conversationSessions.updatedAt));

    const sessionIds = rows.map((r) => r.id);
    if (sessionIds.length === 0) {
      return { sessions: [] };
    }

    const responses = await this.db
      .select()
      .from(sessionResponses)
      .where(inArray(sessionResponses.sessionId, sessionIds));

    const reveals = await this.db
      .select()
      .from(sessionReveals)
      .where(inArray(sessionReveals.sessionId, sessionIds));

    const memberIds = ctx.memberIds;

    return {
      sessions: rows.map((row) => {
        const sessionResponsesRows = responses.filter(
          (r) => r.sessionId === row.id,
        );
        const revealedUserIds = reveals
          .filter((r) => r.sessionId === row.id)
          .map((r) => r.userId);
        const phase = sessionViewerPhase({
          viewerId: user.id,
          memberIds,
          responses: sessionResponsesRows.map((r) => ({
            userId: r.userId,
            submitted: r.submittedAt != null,
          })),
          revealedUserIds,
        });
        return {
          id: row.id,
          promptTitle: row.promptTitle,
          promptText: row.promptText,
          phase,
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    };
  }

  async createSession(user: AuthUser, input: CreateSessionInput) {
    const ctx = await this.requireMembership(user);
    if (ctx.coupleStatus !== "active") {
      throw new ForbiddenException({ reason: "couple_not_active" });
    }

    const [prompt] = await this.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, input.promptId), eq(prompts.kind, "curated")))
      .limit(1);

    if (!prompt) {
      throw new NotFoundException({ reason: "prompt_not_found" });
    }

    const samePrompt = await this.db
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          eq(conversationSessions.promptId, prompt.id),
        ),
      );

    if (samePrompt.length > 0) {
      const reveals = await this.db
        .select({
          sessionId: sessionReveals.sessionId,
          userId: sessionReveals.userId,
        })
        .from(sessionReveals)
        .where(
          inArray(
            sessionReveals.sessionId,
            samePrompt.map((session) => session.id),
          ),
        );

      const open = samePrompt.find((session) =>
        isSessionOpen({
          memberIds: ctx.memberIds,
          revealedUserIds: reveals
            .filter((revealed) => revealed.sessionId === session.id)
            .map((revealed) => revealed.userId),
        }),
      );

      if (open) return { id: open.id };
    }

    const session = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(conversationSessions)
        .values({
          coupleId: ctx.coupleId,
          promptId: prompt.id,
        })
        .returning();

      await tx.insert(sessionResponses).values(
        ctx.memberIds.map((memberId) => ({
          sessionId: created.id,
          userId: memberId,
          body: "",
          submittedAt: null,
        })),
      );

      return created;
    });

    return { id: session.id };
  }

  async getSession(
    user: AuthUser,
    sessionId: string,
  ): Promise<SessionDetailDto> {
    return this.loadDetail(user, sessionId);
  }

  async submitResponse(
    user: AuthUser,
    sessionId: string,
    input: SubmitResponseInput,
  ): Promise<SessionDetailDto> {
    await this.requireSessionMember(user, sessionId);

    const [existing] = await this.db
      .select()
      .from(sessionResponses)
      .where(
        and(
          eq(sessionResponses.sessionId, sessionId),
          eq(sessionResponses.userId, user.id),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException({ reason: "response_row_missing" });
    }
    if (existing.submittedAt != null) {
      throw new ConflictException({ reason: "already_submitted" });
    }

    const now = new Date();
    await this.db
      .update(sessionResponses)
      .set({
        body: input.text,
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(sessionResponses.id, existing.id));

    await this.db
      .update(conversationSessions)
      .set({ updatedAt: now })
      .where(eq(conversationSessions.id, sessionId));

    return this.loadDetail(user, sessionId);
  }

  async revealSession(
    user: AuthUser,
    sessionId: string,
  ): Promise<SessionDetailDto> {
    const ctx = await this.requireSessionMember(user, sessionId);

    const responses = await this.db
      .select()
      .from(sessionResponses)
      .where(eq(sessionResponses.sessionId, sessionId));

    const bothSubmitted = ctx.memberIds.every((id) =>
      responses.some((r) => r.userId === id && r.submittedAt != null),
    );
    if (!bothSubmitted) {
      throw new ForbiddenException({ reason: "not_ready_to_reveal" });
    }

    const [existingReveal] = await this.db
      .select()
      .from(sessionReveals)
      .where(
        and(
          eq(sessionReveals.sessionId, sessionId),
          eq(sessionReveals.userId, user.id),
        ),
      )
      .limit(1);

    if (!existingReveal) {
      const now = new Date();
      await this.db.insert(sessionReveals).values({
        sessionId,
        userId: user.id,
        revealedAt: now,
      });
      await this.db
        .update(conversationSessions)
        .set({ updatedAt: now })
        .where(eq(conversationSessions.id, sessionId));
    }

    return this.loadDetail(user, sessionId);
  }

  private async loadDetail(
    user: AuthUser,
    sessionId: string,
  ): Promise<SessionDetailDto> {
    const ctx = await this.requireSessionMember(user, sessionId);

    const [session] = await this.db
      .select({
        id: conversationSessions.id,
        promptId: prompts.id,
        promptTitle: prompts.title,
        promptDescription: prompts.description,
        promptText: prompts.text,
        promptKind: prompts.kind,
      })
      .from(conversationSessions)
      .innerJoin(prompts, eq(prompts.id, conversationSessions.promptId))
      .where(eq(conversationSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundException({ reason: "session_not_found" });
    }

    const responseRows = await this.db
      .select({
        userId: sessionResponses.userId,
        body: sessionResponses.body,
        submittedAt: sessionResponses.submittedAt,
        displayName: users.displayName,
      })
      .from(sessionResponses)
      .innerJoin(users, eq(users.id, sessionResponses.userId))
      .where(eq(sessionResponses.sessionId, sessionId));

    const revealRows = await this.db
      .select()
      .from(sessionReveals)
      .where(eq(sessionReveals.sessionId, sessionId));

    return buildSessionDetailDto({
      sessionId: session.id,
      viewerId: user.id,
      memberIds: ctx.memberIds,
      prompt: {
        id: session.promptId,
        title: session.promptTitle,
        description: session.promptDescription,
        text: session.promptText,
        kind: session.promptKind,
      },
      responses: responseRows,
      revealedUserIds: revealRows.map((r) => r.userId),
    });
  }

  private async requireMembership(user: AuthUser) {
    const [membership] = await this.db
      .select()
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.userId, user.id),
          eq(coupleMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException({ reason: "no_couple" });
    }

    const [couple] = await this.db
      .select()
      .from(couples)
      .where(eq(couples.id, membership.coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException({ reason: "no_couple" });
    }

    const members = await this.db
      .select({ userId: coupleMemberships.userId })
      .from(coupleMemberships)
      .where(
        and(
          eq(coupleMemberships.coupleId, couple.id),
          eq(coupleMemberships.status, "active"),
        ),
      );

    return {
      coupleId: couple.id,
      coupleStatus: couple.status,
      memberIds: members.map((m) => m.userId),
    };
  }

  private async requireSessionMember(user: AuthUser, sessionId: string) {
    const ctx = await this.requireMembership(user);

    const [session] = await this.db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundException({ reason: "session_not_found" });
    }
    if (session.coupleId !== ctx.coupleId) {
      throw new ForbiddenException({ reason: "not_session_member" });
    }

    return ctx;
  }
}
