import { Test, TestingModule } from "@nestjs/testing";
import { createHash } from "node:crypto";
import { DB } from "../db/db.module.js";
import { TokenService } from "./token.service.js";

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

describe("TokenService", () => {
  const secret = "test-secret-at-least-32-characters-long";

  let service: TokenService;
  const insertedRecord: Array<Record<string, unknown>> = [];
  const mockDatabase = {
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        insertedRecord.push(row);
        return {
          returning: vi.fn(async () => [
            {
              id: "rt-1",
              ...row,
            },
          ]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    select: vi.fn(),
  };

  beforeEach(async () => {
    // TokenService field initializers call loadEnv(); Nest DI cannot inject Env yet.
    process.env.DATABASE_URL ??= "postgres://token-service-test";
    process.env.JWT_SECRET = secret;
    process.env.ACCESS_TOKEN_TTL_SECONDS = "60";
    process.env.REFRESH_TOKEN_TTL_SECONDS = "3600";

    vi.clearAllMocks();
    insertedRecord.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService, { provide: DB, useValue: mockDatabase }],
    }).compile();

    service = module.get(TokenService);
  });

  it("issueTokenPair stores only a hash of the refresh token", async () => {
    // Security invariant: raw refresh must never be written to Postgres.
    const pair = await service.issueTokenPair({
      id: "user-1",
      email: "a@example.com",
      emailVerified: false,
    });

    expect(pair.accessToken.length).toBeGreaterThan(20);
    expect(pair.refreshToken.length).toBeGreaterThan(20);
    expect(insertedRecord[0]?.tokenHash).toBe(sha256(pair.refreshToken));
    expect(insertedRecord[0]?.tokenHash).not.toBe(pair.refreshToken);
  });

  it("verifyAccessToken returns AuthUser claims", async () => {
    const pair = await service.issueTokenPair({
      id: "user-1",
      email: "a@example.com",
      emailVerified: true,
    });
    const user = await service.verifyAccessToken(pair.accessToken);
    expect(user).toEqual({
      id: "user-1",
      email: "a@example.com",
      emailVerified: true,
    });
  });

  it("sets revokedAt on the User's live tokens", async () => {
    const setSpy = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    mockDatabase.update.mockReturnValueOnce({ set: setSpy });

    await service.revokeAllForUser("user-1");

    expect(mockDatabase.update).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
  });
});
