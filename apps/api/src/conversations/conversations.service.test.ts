import { describe, expect, it, vi } from "vitest";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DB } from "../db/db.module.js";
import { ConversationsService } from "./conversations.service.js";
import { PushService } from "../push/push.service.js";

const fakePush = () => ({ notifyNewConversation: vi.fn() });
import { buildSessionDetailDto } from "./session-detail.mapper.js";
import { queryResult } from "../../test/factories.js";

describe("buildSessionDetailDto", () => {
  const base = {
    sessionId: "s1",
    parentSessionId: null,
    memberIds: ["u1", "u2"],
    prompt: {
      id: "p1",
      title: "Everyday",
      description: "desc",
      text: "What stayed with you?",
      kind: "curated",
    },
  };

  it("hides partner text before partner submit", () => {
    const dto = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: [
        {
          userId: "u1",
          displayName: "Rueben",
          body: "Tea",
          submittedAt: new Date(),
        },
        {
          userId: "u2",
          displayName: "Alex",
          body: "",
          submittedAt: null,
        },
      ],
      revealedUserIds: [],
    });

    expect(dto.phase).toBe("waiting_for_partner");
    expect(dto.partnerSubmitted).toBe(false);
    expect(dto.responses.find((r) => r.userId === "u1")?.text).toBe("Tea");
    expect(dto.responses.find((r) => r.userId === "u2")?.text).toBeNull();
  });

  it("keeps partner text redacted when both submitted but viewer has not revealed", () => {
    const dto = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: [
        {
          userId: "u1",
          displayName: "Rueben",
          body: "Tea",
          submittedAt: new Date(),
        },
        {
          userId: "u2",
          displayName: "Alex",
          body: "Walk",
          submittedAt: new Date(),
        },
      ],
      revealedUserIds: [],
    });

    expect(dto.phase).toBe("ready_to_reveal");
    expect(dto.responses.find((r) => r.userId === "u2")?.text).toBeNull();
  });

  it("shows partner text only for the viewer who revealed", () => {
    const forU1 = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: [
        {
          userId: "u1",
          displayName: "Rueben",
          body: "Tea",
          submittedAt: new Date(),
        },
        {
          userId: "u2",
          displayName: "Alex",
          body: "Walk",
          submittedAt: new Date(),
        },
      ],
      revealedUserIds: ["u1"],
    });
    const forU2 = buildSessionDetailDto({
      ...base,
      viewerId: "u2",
      responses: [
        {
          userId: "u1",
          displayName: "Rueben",
          body: "Tea",
          submittedAt: new Date(),
        },
        {
          userId: "u2",
          displayName: "Alex",
          body: "Walk",
          submittedAt: new Date(),
        },
      ],
      revealedUserIds: ["u1"],
    });

    expect(forU1.phase).toBe("revealed");
    expect(forU1.responses.find((r) => r.userId === "u2")?.text).toBe("Walk");
    expect(forU2.phase).toBe("ready_to_reveal");
    expect(forU2.responses.find((r) => r.userId === "u1")?.text).toBeNull();
  });

  const bothSubmitted = [
    {
      userId: "u1",
      displayName: "Rueben",
      body: "Tea",
      submittedAt: new Date(),
    },
    {
      userId: "u2",
      displayName: "Alex",
      body: "Walk",
      submittedAt: new Date(),
    },
  ];
  const followUpSource = [
    {
      prompt: { id: "f1", text: "What made it stand out?" },
      session: {
        id: "c1",
        responses: [
          {
            userId: "u1",
            displayName: "Rueben",
            body: "Mine",
            submittedAt: new Date(),
          },
          {
            userId: "u2",
            displayName: "Alex",
            body: "Theirs",
            submittedAt: null,
          },
        ],
      },
    },
    { prompt: { id: "f2", text: "How could we make room?" }, session: null },
  ];

  it("omits followUps until both have revealed (FR-19)", () => {
    const dto = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: bothSubmitted,
      revealedUserIds: ["u1"],
      followUps: followUpSource,
    });
    expect(dto.followUps).toBeUndefined();
  });

  it("includes followUps once both have revealed, redacting the unsubmitted partner", () => {
    const dto = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: bothSubmitted,
      revealedUserIds: ["u1", "u2"],
      followUps: followUpSource,
    });

    expect(dto.followUps).toHaveLength(2);
    const [started, notStarted] = dto.followUps!;
    expect(started!.phase).toBe("waiting_for_partner");
    expect(started!.responses.find((r) => r.userId === "u1")?.text).toBe(
      "Mine",
    );
    expect(started!.responses.find((r) => r.userId === "u2")?.text).toBeNull();
    expect(notStarted).toMatchObject({
      sessionId: null,
      phase: null,
      responses: [],
    });
  });

  it("auto-shows follow-up answers when both submitted, with no reveal", () => {
    const dto = buildSessionDetailDto({
      ...base,
      viewerId: "u1",
      responses: bothSubmitted,
      revealedUserIds: ["u1", "u2"],
      followUps: [
        {
          prompt: { id: "f1", text: "Q" },
          session: { id: "c1", responses: bothSubmitted },
        },
      ],
    });
    expect(dto.followUps![0]!.phase).toBe("revealed");
    expect(
      dto.followUps![0]!.responses.find((r) => r.userId === "u2")?.text,
    ).toBe("Walk");
  });

  it("treats a child session as revealed after both submit, with no followUps", () => {
    const dto = buildSessionDetailDto({
      ...base,
      parentSessionId: "parent",
      viewerId: "u1",
      responses: bothSubmitted,
      revealedUserIds: [],
      followUps: followUpSource,
    });
    expect(dto.phase).toBe("revealed");
    expect(dto.prompt.kind).toBe("follow_up");
    expect(dto.followUps).toBeUndefined();
  });
});

describe("ConversationsService", () => {
  it("rejects createSession when couple is not active", async () => {
    const mockDb = {
      select: vi.fn(),
    };

    // membership
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              { coupleId: "c1", userId: "u1", status: "active" },
            ]),
          })),
        })),
      })
      // couple
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: "c1", status: "forming" }]),
          })),
        })),
      })
      // members
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
        })),
      });

    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: mockDb },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();

    const service = module.get(ConversationsService);

    await expect(
      service.createSession(
        { id: "u1", email: "a@example.com", emailVerified: true },
        { promptId: "a0000000-0000-4000-8000-000000000011" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe("createSession on a retired prompt", () => {
    const retiredPrompt = {
      id: "a0000000-0000-4000-8000-000000000011",
      kind: "curated",
      retiredAt: new Date("2026-10-01T00:00:00Z"),
    };

    function mockDbFor(existingSessions: { id: string }[]) {
      const mockDb = { select: vi.fn() };

      mockDb.select
        // membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { coupleId: "c1", userId: "u1", status: "active" },
              ]),
            })),
          })),
        })
        // couple
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "c1", status: "active" }]),
            })),
          })),
        })
        // members
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
          })),
        })
        // prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [retiredPrompt]),
            })),
          })),
        })
        // sessions on the same prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => existingSessions),
          })),
        })
        // reveals (nobody has revealed, so any session is open)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        });

      return mockDb;
    }

    async function serviceWith(mockDb: object) {
      const module = await Test.createTestingModule({
        providers: [
          ConversationsService,
          { provide: DB, useValue: mockDb },
          { provide: PushService, useValue: fakePush() },
        ],
      }).compile();
      return module.get(ConversationsService);
    }

    const user = { id: "u1", email: "a@example.com", emailVerified: true };

    it("refuses to start a new session", async () => {
      const service = await serviceWith(mockDbFor([]));

      await expect(
        service.createSession(user, { promptId: retiredPrompt.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("still returns the couple's open session", async () => {
      const service = await serviceWith(mockDbFor([{ id: "s1" }]));

      await expect(
        service.createSession(user, { promptId: retiredPrompt.id }),
      ).resolves.toEqual({ id: "s1" });
    });
  });

  it("rejects double submit", async () => {
    const mockDb = {
      select: vi.fn(),
      update: vi.fn(),
    };

    // requireSessionMember → membership
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              { coupleId: "c1", userId: "u1", status: "active" },
            ]),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: "c1", status: "active" }]),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: "s1", coupleId: "c1" }]),
          })),
        })),
      })
      // both responses; this user's is already submitted
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              id: "r1",
              sessionId: "s1",
              userId: "u1",
              body: "done",
              submittedAt: new Date(),
            },
            {
              id: "r2",
              sessionId: "s1",
              userId: "u2",
              body: "",
              submittedAt: null,
            },
          ]),
        })),
      });

    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: mockDb },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();

    const service = module.get(ConversationsService);

    await expect(
      service.submitResponse(
        { id: "u1", email: "a@example.com", emailVerified: true },
        "s1",
        { text: "again" },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe("createSession notifications", () => {
    const user = { id: "u1", email: "a@example.com", emailVerified: true };
    const prompt = {
      id: "a0000000-0000-4000-8000-000000000011",
      kind: "curated",
      retiredAt: null,
    };

    function mockDbFor(existingSessions: { id: string }[]) {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: "s-new" }]),
          })),
        })),
      };
      const mockDb = {
        select: vi.fn(),
        transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      };

      mockDb.select
        // membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { coupleId: "c1", userId: "u1", status: "active" },
              ]),
            })),
          })),
        })
        // couple
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "c1", status: "active" }]),
            })),
          })),
        })
        // members
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
          })),
        })
        // prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [prompt]),
            })),
          })),
        })
        // sessions on the same prompt
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => existingSessions),
          })),
        })
        // reveals (nobody has revealed, so any session is open)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => []),
          })),
        });

      return mockDb;
    }

    async function setup(existingSessions: { id: string }[]) {
      const push = fakePush();
      const module = await Test.createTestingModule({
        providers: [
          ConversationsService,
          { provide: DB, useValue: mockDbFor(existingSessions) },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      return { service: module.get(ConversationsService), push };
    }

    it("sends nothing when a new session is created", async () => {
      const { service, push } = await setup([]);

      await expect(
        service.createSession(user, { promptId: prompt.id }),
      ).resolves.toEqual({ id: "s-new" });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });

    it("sends nothing when the open session is reused", async () => {
      const { service, push } = await setup([{ id: "s1" }]);

      await service.createSession(user, { promptId: prompt.id });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });
  });

  describe("submitResponse notifications", () => {
    const user = { id: "u1", email: "a@example.com", emailVerified: true };

    function mockDbFor(
      partnerSubmittedAt: Date | null,
      session: Record<string, unknown> = { id: "s1", coupleId: "c1" },
    ) {
      const mockDb = {
        select: vi.fn(),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
        })),
      };

      mockDb.select
        // membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { coupleId: "c1", userId: "u1", status: "active" },
              ]),
            })),
          })),
        })
        // couple
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "c1", status: "active" }]),
            })),
          })),
        })
        // members
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
          })),
        })
        // session
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [session]),
            })),
          })),
        })
        // both responses
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              {
                id: "r1",
                sessionId: "s1",
                userId: "u1",
                body: "",
                submittedAt: null,
              },
              {
                id: "r2",
                sessionId: "s1",
                userId: "u2",
                body: "",
                submittedAt: partnerSubmittedAt,
              },
            ]),
          })),
        });

      return mockDb;
    }

    async function setup(
      partnerSubmittedAt: Date | null,
      session?: Record<string, unknown>,
    ) {
      const push = fakePush();
      const module = await Test.createTestingModule({
        providers: [
          ConversationsService,
          { provide: DB, useValue: mockDbFor(partnerSubmittedAt, session) },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      const service = module.get(ConversationsService);
      // The detail read-back is covered by buildSessionDetailDto's tests.
      vi.spyOn(
        service as unknown as { loadDetail: () => Promise<unknown> },
        "loadDetail",
      ).mockResolvedValue({});
      return { service, push };
    }

    it("pings the partner when the first answer is submitted", async () => {
      const { service, push } = await setup(null);

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifyNewConversation).toHaveBeenCalledWith({
        starterId: "u1",
        partnerIds: ["u2"],
        sessionId: "s1",
      });
    });

    it("sends nothing for a follow-up answer", async () => {
      const { service, push } = await setup(null, {
        id: "s1",
        coupleId: "c1",
        parentSessionId: "s0",
      });

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });

    it("sends nothing when the partner already submitted", async () => {
      const { service, push } = await setup(new Date());

      await service.submitResponse(user, "s1", { text: "my answer" });
      expect(push.notifyNewConversation).not.toHaveBeenCalled();
    });
  });
});

describe("ConversationsService.startFollowUp", () => {
  const user = { id: "u1", email: "a@example.com", emailVerified: true };
  const parent = {
    id: "s1",
    coupleId: "c1",
    promptId: "p1",
    parentSessionId: null,
  };

  function setup(opts: {
    reveals: string[];
    prompt?: Record<string, unknown>;
    existing?: { id: string };
    session?: Record<string, unknown>;
  }) {
    const insertSession = {
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: "child-1" }]),
        })),
      })),
    };
    const insertResponses = { values: vi.fn(async () => undefined) };
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce(insertSession)
        .mockReturnValueOnce(insertResponses),
    };

    const db = {
      select: vi.fn(),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    db.select
      .mockReturnValueOnce(
        queryResult([{ coupleId: "c1", userId: "u1", status: "active" }]),
      )
      .mockReturnValueOnce(queryResult([{ id: "c1", status: "active" }]))
      .mockReturnValueOnce(queryResult([{ userId: "u1" }, { userId: "u2" }]))
      .mockReturnValueOnce(queryResult([opts.session ?? parent]))
      .mockReturnValueOnce(
        queryResult(opts.reveals.map((userId) => ({ userId }))),
      )
      .mockReturnValueOnce(queryResult(opts.prompt ? [opts.prompt] : []))
      .mockReturnValueOnce(queryResult(opts.existing ? [opts.existing] : []));
    return { db, tx };
  }

  async function service(db: unknown) {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: db },
        { provide: PushService, useValue: fakePush() },
      ],
    }).compile();
    return module.get(ConversationsService);
  }

  const followUpPrompt = {
    id: "f1",
    kind: "follow_up",
    parentPromptId: "p1",
    retiredAt: null,
  };

  it("is locked until both partners have revealed", async () => {
    const { db } = setup({ reveals: ["u1"] });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).rejects.toMatchObject({ response: { reason: "follow_ups_locked" } });
  });

  it("rejects a follow-up of a follow-up", async () => {
    const { db } = setup({
      reveals: [],
      session: { ...parent, parentSessionId: "x" },
    });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).rejects.toMatchObject({ response: { reason: "follow_up_of_follow_up" } });
  });

  it("rejects a prompt that doesn't belong to this session's prompt", async () => {
    const { db } = setup({ reveals: ["u1", "u2"] });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "other" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the existing child instead of creating a second one", async () => {
    const { db } = setup({
      reveals: ["u1", "u2"],
      prompt: followUpPrompt,
      existing: { id: "child-0" },
    });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).resolves.toEqual({ id: "child-0" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("creates the child with a response row per member", async () => {
    const { db, tx } = setup({ reveals: ["u1", "u2"], prompt: followUpPrompt });
    await expect(
      (await service(db)).startFollowUp(user, "s1", { promptId: "f1" }),
    ).resolves.toEqual({ id: "child-1" });
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
