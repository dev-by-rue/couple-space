import { describe, expect, it, vi } from "vitest";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DB } from "../db/db.module.js";
import { ConversationsService } from "./conversations.service.js";
import { buildSessionDetailDto } from "./session-detail.mapper.js";

describe("buildSessionDetailDto", () => {
  const base = {
    sessionId: "s1",
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
        providers: [ConversationsService, { provide: DB, useValue: mockDb }],
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
      // existing response already submitted
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [
              {
                id: "r1",
                sessionId: "s1",
                userId: "u1",
                body: "done",
                submittedAt: new Date(),
              },
            ]),
          })),
        })),
      });

    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: DB, useValue: mockDb },
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
});
