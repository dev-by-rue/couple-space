import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { CouplesService } from "./couples.service.js";

describe("CouplesService.createCouple", () => {
  let service: CouplesService;

  const mockDb = {
    select: vi.fn(),
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouplesService,
        { provide: DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get(CouplesService);
  });

  it("creates a forming couple when user has no active membership", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    });

    mockDb.transaction.mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => {
            // Drizzle builders are thenable AND expose .returning()
            const builder = {
              returning: vi.fn(async () => [
                { id: "couple-1", status: "forming" },
              ]),
              then: (
                resolve: (value: unknown) => void,
                reject?: (reason: unknown) => void,
              ) => Promise.resolve(undefined).then(resolve, reject),
            };
            return builder;
          }),
        })),
      };
      return fn(tx);
    });

    const result = await service.createCouple({
      id: "user-1",
      email: "a@example.com",
      emailVerified: true,
    });

    expect(result).toEqual({ coupleId: "couple-1", status: "forming" });
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it("rejects when user already has an active membership", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            { id: "m1", userId: "user-1", status: "active" },
          ]),
        })),
      })),
    });

    await expect(
      service.createCouple({
        id: "user-1",
        email: "a@example.com",
        emailVerified: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
