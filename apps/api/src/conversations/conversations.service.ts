import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  areFollowUpsUnlocked,
  isSessionOpen,
  sessionViewerPhase,
  type PromptDepth,
} from "@couple-space/domain";
import {
  conversationSessions,
  coupleMemberships,
  couples,
  promptTagLinks,
  promptTags,
  promptThemes,
  prompts,
  sessionResponses,
  sessionReveals,
  users,
  type Db,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { PushService } from "../push/push.service.js";
import type { AuthUser } from "../auth/auth-user.types.js";
import type { CreateSessionInput } from "./dto/create-session.schema.js";
import type { SubmitResponseInput } from "./dto/submit-response.schema.js";
import type { StartFollowUpInput } from "./dto/start-follow-up.schema.js";
import {
  buildSessionDetailDto,
  type SessionDetailDto,
  type SessionDetailSource,
} from "./session-detail.mapper.js";
import type { SaveDraftInput } from "./dto/save-draft.schema.js";

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly push: PushService,
  ) {}

  async listThemes(_user: AuthUser) {
    const themes = await this.db
      .select()
      .from(promptThemes)
      .orderBy(asc(promptThemes.sortOrder), asc(promptThemes.title));

    const allPrompts = await this.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.kind, "curated"), isNull(prompts.retiredAt)))
      .orderBy(asc(prompts.sortOrder), asc(prompts.title));

    // One query for every prompt's tag slugs, grouped in memory.
    const links =
      allPrompts.length === 0
        ? []
        : await this.db
            .select({
              promptId: promptTagLinks.promptId,
              slug: promptTags.slug,
            })
            .from(promptTagLinks)
            .innerJoin(promptTags, eq(promptTags.id, promptTagLinks.tagId))
            .where(
              inArray(
                promptTagLinks.promptId,
                allPrompts.map((p) => p.id),
              ),
            );
    const tagsByPrompt = new Map<string, string[]>();
    for (const link of links) {
      tagsByPrompt.set(link.promptId, [
        ...(tagsByPrompt.get(link.promptId) ?? []),
        link.slug,
      ]);
    }

    // The filter chips' labels and order come from here, not from the web.
    const tags = await this.db
      .select({ slug: promptTags.slug, label: promptTags.label })
      .from(promptTags)
      .orderBy(asc(promptTags.sortOrder));

    return {
      tags,
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
            // Curated prompts always have a depth (prompts_catalogue_key_depth check).
            depth: p.depth as PromptDepth,
            tags: tagsByPrompt.get(p.id) ?? [],
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
      .where(
        and(
          eq(conversationSessions.coupleId, ctx.coupleId),
          isNull(conversationSessions.parentSessionId),
        ),
      )
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
          isNull(conversationSessions.parentSessionId),
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

    // Checked after the reuse above so a couple mid-conversation on a
    // retired prompt can still get back into it.
    if (prompt.retiredAt) {
      throw new NotFoundException({ reason: "prompt_retired" });
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
    const ctx = await this.requireSessionMember(user, sessionId);

    const responses = await this.db
      .select()
      .from(sessionResponses)
      .where(eq(sessionResponses.sessionId, sessionId));

    const existing = responses.find((r) => r.userId === user.id);

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

    // Fire and forget: notifySessionEvent never throws. The domain decides
    // what this answer means (new conversation, ready to reveal, follow-up).
    void this.push.notifySessionEvent({
      memberIds: ctx.memberIds,
      event: {
        kind: "answered",
        actorId: user.id,
        sessionId,
        parentSessionId: ctx.session.parentSessionId,
        submittedUserIds: [
          ...responses
            .filter((r) => r.submittedAt != null)
            .map((r) => r.userId),
          user.id,
        ],
      },
    });

    return this.loadDetail(user, sessionId);
  }

  async revealSession(
    user: AuthUser,
    sessionId: string,
  ): Promise<SessionDetailDto> {
    const ctx = await this.requireSessionMember(user, sessionId);
    if (ctx.session.parentSessionId != null) {
      // Q22: follow-ups auto-show; there's nothing to reveal.
      throw new BadRequestException({ reason: "follow_up_has_no_reveal" });
    }

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

      // Read after the insert, so a partner who revealed a moment earlier is
      // included and nobody gets "has seen your answer" after revealing.
      const reveals = await this.db
        .select({ userId: sessionReveals.userId })
        .from(sessionReveals)
        .where(eq(sessionReveals.sessionId, sessionId));
      // Only on a new reveal: tapping Reveal again never re-notifies.
      void this.push.notifySessionEvent({
        memberIds: ctx.memberIds,
        event: {
          kind: "revealed",
          actorId: user.id,
          sessionId,
          revealedUserIds: reveals.map((r) => r.userId),
        },
      });
    }

    return this.loadDetail(user, sessionId);
  }

  /**
   * Starts (or returns) the child session for one follow-up of a main
   * session. Either partner can start it; the second call returns the same id.
   */
  async startFollowUp(
    user: AuthUser,
    parentSessionId: string,
    input: StartFollowUpInput,
  ): Promise<{ id: string }> {
    const ctx = await this.requireSessionMember(user, parentSessionId);
    if (ctx.coupleStatus !== "active") {
      throw new ForbiddenException({ reason: "couple_not_active" });
    }
    if (ctx.session.parentSessionId != null) {
      // E-12: one level only.
      throw new BadRequestException({ reason: "follow_up_of_follow_up" });
    }

    const reveals = await this.db
      .select({ userId: sessionReveals.userId })
      .from(sessionReveals)
      .where(eq(sessionReveals.sessionId, parentSessionId));
    if (
      !areFollowUpsUnlocked({
        memberIds: ctx.memberIds,
        revealedUserIds: reveals.map((r) => r.userId),
      })
    ) {
      throw new ForbiddenException({ reason: "follow_ups_locked" });
    }

    const [prompt] = await this.db
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.id, input.promptId),
          eq(prompts.kind, "follow_up"),
          eq(prompts.parentPromptId, ctx.session.promptId),
        ),
      )
      .limit(1);
    if (!prompt) {
      throw new NotFoundException({ reason: "prompt_not_found" });
    }

    const existing = await this.findChild(parentSessionId, prompt.id);
    if (existing) return existing;

    if (prompt.retiredAt) {
      throw new NotFoundException({ reason: "prompt_retired" });
    }

    const created = await this.db.transaction(async (tx) => {
      // The unique index settles a race where both partners tap at once.
      const [row] = await tx
        .insert(conversationSessions)
        .values({
          coupleId: ctx.coupleId,
          promptId: prompt.id,
          parentSessionId,
        })
        .onConflictDoNothing()
        .returning({ id: conversationSessions.id });
      if (!row) return null;

      await tx.insert(sessionResponses).values(
        ctx.memberIds.map((memberId) => ({
          sessionId: row.id,
          userId: memberId,
          body: "",
          submittedAt: null,
        })),
      );
      return row;
    });

    if (created) return created;
    // Lost the race: the partner's insert won.
    const winner = await this.findChild(parentSessionId, prompt.id);
    if (!winner) throw new ConflictException({ reason: "follow_up_conflict" });
    return winner;
  }

  private async findChild(
    parentSessionId: string,
    promptId: string,
  ): Promise<{ id: string } | undefined> {
    const [row] = await this.db
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.parentSessionId, parentSessionId),
          eq(conversationSessions.promptId, promptId),
        ),
      )
      .limit(1);
    return row;
  }

  private async loadDetail(
    user: AuthUser,
    sessionId: string,
  ): Promise<SessionDetailDto> {
    const ctx = await this.requireSessionMember(user, sessionId);

    const [session] = await this.db
      .select({
        id: conversationSessions.id,
        parentSessionId: conversationSessions.parentSessionId,
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
    const revealedUserIds = revealRows.map((r) => r.userId);

    const followUps =
      session.parentSessionId == null &&
      areFollowUpsUnlocked({ memberIds: ctx.memberIds, revealedUserIds })
        ? await this.loadFollowUps(session.id, session.promptId)
        : undefined;

    return buildSessionDetailDto({
      sessionId: session.id,
      parentSessionId: session.parentSessionId,
      followUps,
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
      revealedUserIds,
    });
  }

  /** Follow-up prompts for a main session, each with its child session if started. */
  private async loadFollowUps(
    parentSessionId: string,
    parentPromptId: string,
  ): Promise<NonNullable<SessionDetailSource["followUps"]>> {
    const children = await this.db
      .select({
        id: conversationSessions.id,
        promptId: conversationSessions.promptId,
      })
      .from(conversationSessions)
      .where(eq(conversationSessions.parentSessionId, parentSessionId));
    const startedPromptIds = children.map((c) => c.promptId);

    // Retired follow-ups stay visible if the couple already started them.
    const followUpPrompts = await this.db
      .select({ id: prompts.id, text: prompts.text })
      .from(prompts)
      .where(
        and(
          eq(prompts.kind, "follow_up"),
          eq(prompts.parentPromptId, parentPromptId),
          startedPromptIds.length > 0
            ? or(
                isNull(prompts.retiredAt),
                inArray(prompts.id, startedPromptIds),
              )
            : isNull(prompts.retiredAt),
        ),
      )
      .orderBy(asc(prompts.sortOrder));

    const childResponses =
      children.length === 0
        ? []
        : await this.db
            .select({
              sessionId: sessionResponses.sessionId,
              userId: sessionResponses.userId,
              body: sessionResponses.body,
              submittedAt: sessionResponses.submittedAt,
              displayName: users.displayName,
            })
            .from(sessionResponses)
            .innerJoin(users, eq(users.id, sessionResponses.userId))
            .where(
              inArray(
                sessionResponses.sessionId,
                children.map((c) => c.id),
              ),
            );

    return followUpPrompts.map((prompt) => {
      const child = children.find((c) => c.promptId === prompt.id);
      return {
        prompt,
        session: child
          ? {
              id: child.id,
              responses: childResponses.filter((r) => r.sessionId === child.id),
            }
          : null,
      };
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

    return { ...ctx, session };
  }
}
