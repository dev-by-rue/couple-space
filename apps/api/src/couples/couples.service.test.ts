import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { CouplesService } from "./couples.service.js";
import {
  queryResult,
  makeUser,
  makeMembership,
  makeInvitation,
  makeMember,
} from "../../test/factories.js";

describe("CouplesService", () => {
  let service: CouplesService;

  const mockDb = {
    select: vi.fn(),
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CouplesService, { provide: DB, useValue: mockDb }],
    }).compile();

    service = module.get(CouplesService);
  });

  describe("createCouple", () => {
    it("creates a forming couple when user has no active membership", async () => {
      mockDb.select.mockReturnValue(queryResult([]));
      mockDb.transaction.mockImplementation(async (fn) => {
        const tx = {
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              ...queryResult([]),
              returning: vi.fn(async () => [
                { id: "couple-1", status: "forming" },
              ]),
            })),
          })),
        };
        return fn(tx);
      });

      const result = await service.createCouple(makeUser());

      expect(result).toEqual({ coupleId: "couple-1", status: "forming" });
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("rejects when user already has an active membership", async () => {
      mockDb.select.mockReturnValue(queryResult([makeMembership()]));

      await expect(service.createCouple(makeUser())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("getMyCouple", () => {
    /** Queues the four selects in the order getMyCouple runs them. */
    function arrangeCouple({
      invitations = [],
    }: { invitations?: ReturnType<typeof makeInvitation>[] } = {}) {
      mockDb.select
        .mockReturnValueOnce(queryResult([makeMembership()]))
        .mockReturnValueOnce(
          queryResult([{ id: "couple-1", status: "forming" }]),
        )
        .mockReturnValueOnce(queryResult([makeMember()]))
        .mockReturnValueOnce(queryResult(invitations));
    }

    it("returns the pending invitation", async () => {
      const invitation = makeInvitation();
      arrangeCouple({ invitations: [invitation] });

      const result = await service.getMyCouple(makeUser());

      expect(result.pendingInvitation).toEqual(invitation);
    });

    it("returns null when there is no pending invitation", async () => {
      arrangeCouple();

      const result = await service.getMyCouple(makeUser());

      expect(result.pendingInvitation).toBeNull();
    });

    it("throws no_couple when the user has no active membership", async () => {
      mockDb.select.mockReturnValueOnce(queryResult([]));

      await expect(service.getMyCouple(makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
