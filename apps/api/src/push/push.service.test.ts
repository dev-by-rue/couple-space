import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { DB } from "../db/db.module.js";
import { PUSH, type PushPort } from "./push.port.js";
import { PushService } from "./push.service.js";

const subscription = (endpoint: string) => ({
  id: endpoint,
  userId: "u2",
  endpoint,
  p256dh: "p",
  auth: "a",
  createdAt: new Date(),
});

function mockDbWith(subscriptions: ReturnType<typeof subscription>[]) {
  const deleteWhere = vi.fn(async () => undefined);
  const mockDb = {
    select: vi.fn(),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  mockDb.select
    // members' display names
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: "u1", displayName: "Rue" },
          { id: "u2", displayName: "Alex" },
        ]),
      })),
    })
    // partner's subscriptions
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(async () => subscriptions),
      })),
    });
  return { mockDb, deleteWhere };
}

async function serviceWith(mockDb: object, push: PushPort) {
  const module = await Test.createTestingModule({
    providers: [
      PushService,
      { provide: DB, useValue: mockDb },
      { provide: PUSH, useValue: push },
    ],
  }).compile();
  return module.get(PushService);
}

const input = {
  memberIds: ["u1", "u2"],
  event: {
    kind: "answered" as const,
    actorId: "u1",
    sessionId: "s1",
    parentSessionId: null,
    submittedUserIds: ["u1"],
  },
};

describe("PushService.notifySessionEvent", () => {
  it("sends the notification to every partner device", async () => {
    const { mockDb } = mockDbWith([
      subscription("https://fcm.googleapis.com/a"),
      subscription("https://web.push.apple.com/b"),
    ]);
    const push = { send: vi.fn<PushPort["send"]>(async () => "ok") };
    const service = await serviceWith(mockDb, push);

    await service.notifySessionEvent(input);

    expect(push.send).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(push.send.mock.calls[0][1]);
    expect(payload).toEqual({
      title: "New conversation",
      body: "Rue started a new conversation",
      url: "/conversation/s1",
      tag: "session-s1",
    });
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("deletes subscriptions the push service says are gone", async () => {
    const { mockDb, deleteWhere } = mockDbWith([
      subscription("https://fcm.googleapis.com/live"),
      subscription("https://fcm.googleapis.com/dead"),
    ]);
    const push = {
      send: vi.fn(async (target: { endpoint: string }) =>
        target.endpoint.endsWith("dead") ? ("gone" as const) : ("ok" as const),
      ),
    };
    const service = await serviceWith(mockDb, push);

    await service.notifySessionEvent(input);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("never throws when sending fails", async () => {
    const { mockDb } = mockDbWith([
      subscription("https://fcm.googleapis.com/a"),
    ]);
    const push = { send: vi.fn(async () => Promise.reject(new Error("down"))) };
    const service = await serviceWith(mockDb, push);

    await expect(service.notifySessionEvent(input)).resolves.toBeUndefined();
  });

  it("never throws when the database fails", async () => {
    const mockDb = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await expect(service.notifySessionEvent(input)).resolves.toBeUndefined();
    expect(push.send).not.toHaveBeenCalled();
  });

  it("does nothing without a partner", async () => {
    const mockDb = { select: vi.fn() };
    const push = { send: vi.fn() };
    const service = await serviceWith(mockDb, push);

    await service.notifySessionEvent({ ...input, memberIds: ["u1"] });

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("sends nothing when the rules return no targets", async () => {
    const { mockDb } = mockDbWith([
      subscription("https://fcm.googleapis.com/a"),
    ]);
    const push = { send: vi.fn<PushPort["send"]>(async () => "ok") };
    const service = await serviceWith(mockDb, push);

    // Both revealed: A3 sends nothing.
    await service.notifySessionEvent({
      memberIds: ["u1", "u2"],
      event: {
        kind: "revealed",
        actorId: "u2",
        sessionId: "s1",
        revealedUserIds: ["u1", "u2"],
      },
    });

    expect(push.send).not.toHaveBeenCalled();
  });
});
