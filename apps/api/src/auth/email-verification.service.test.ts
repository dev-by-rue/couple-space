import { Test, TestingModule } from "@nestjs/testing";
import { createHash } from "node:crypto";
import {
  emailVerificationTokens,
  users,
} from "@couple-space/database";
import { DB } from "../db/db.module.js";
import { MAIL } from "../mail/mail.port.js";
import {
  EmailVerificationService,
  InvalidOrExpiredTokenError,
} from "./email-verification.service.js";

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function rawTokenFromMailText(text: string): string {
  const match = text.match(/verify-email\?token=([^\s]+)/);
  if (!match?.[1]) {
    throw new Error("verify link not found in mail text");
  }
  return decodeURIComponent(match[1]);
}

const USER_ID = "11111111-1111-1111-1111-111111111111";
const EMAIL = "a@example.com";
const RAW_TOKEN = "fixed-raw-token-for-consume-tests";

describe("EmailVerificationService.sendVerificationEmail", () => {
  let service: EmailVerificationService;
  let mockMail: { sendMail: ReturnType<typeof vi.fn> };

  const insertedRows: Array<Record<string, unknown>> = [];
  const invalidatedUserIds: string[] = [];

  const mockDatabase = {
    update: vi.fn(() => ({
      set: vi.fn((values: { usedAt: Date }) => ({
        where: vi.fn(async () => {
          invalidatedUserIds.push(USER_ID);
          return undefined;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        insertedRows.push(row);
        return Promise.resolve(undefined);
      }),
    })),
  };

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "postgres://email-verification-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";
    process.env.WEB_ORIGIN = "http://localhost:3000";

    vi.clearAllMocks();
    insertedRows.length = 0;
    invalidatedUserIds.length = 0;

    mockMail = { sendMail: vi.fn(async () => undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: DB, useValue: mockDatabase },
        { provide: MAIL, useValue: mockMail },
      ],
    }).compile();

    service = module.get(EmailVerificationService);
  });

  it("sends verify link, then invalidates prior unused tokens and inserts hash", async () => {
    await service.sendVerificationEmail(USER_ID, EMAIL);

    expect(mockMail.sendMail).toHaveBeenCalledBefore(
      mockDatabase.update as unknown as ReturnType<typeof vi.fn>,
    );
    expect(mockDatabase.update).toHaveBeenCalled();
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.userId).toBe(USER_ID);
    expect(insertedRows[0]?.expiresAt).toBeInstanceOf(Date);

    expect(mockMail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: EMAIL,
        subject: expect.any(String),
        text: expect.stringContaining(
          "http://localhost:3000/verify-email?token=",
        ),
      }),
    );

    const mailArg = mockMail.sendMail.mock.calls[0]?.[0];
    const rawFromLink = rawTokenFromMailText(mailArg?.text ?? "");
    expect(insertedRows[0]?.tokenHash).toBe(sha256(rawFromLink));
  });

  it("does not store the raw token in token_hash", async () => {
    await service.sendVerificationEmail(USER_ID, EMAIL);

    const mailArg = mockMail.sendMail.mock.calls[0]?.[0];
    const rawFromLink = rawTokenFromMailText(mailArg?.text ?? "");
    expect(insertedRows[0]?.tokenHash).not.toBe(rawFromLink);
    expect(insertedRows[0]?.tokenHash).toBe(sha256(rawFromLink));
  });

  it("does not write tokens when mail send fails", async () => {
    mockMail.sendMail.mockRejectedValueOnce(new Error("smtp down"));

    await expect(
      service.sendVerificationEmail(USER_ID, EMAIL),
    ).rejects.toThrow("smtp down");

    expect(mockDatabase.update).not.toHaveBeenCalled();
    expect(insertedRows).toHaveLength(0);
  });
});

describe("EmailVerificationService.consumeToken", () => {
  let service: EmailVerificationService;

  type TokenRow = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  };

  let tokenRow: TokenRow | null;

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (tokenRow ? [tokenRow] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: { usedAt: Date }) => ({
        where: vi.fn(async () => {
          if (tokenRow) {
            tokenRow.usedAt = values.usedAt;
          }
          return undefined;
        }),
      })),
    })),
  };

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "postgres://email-verification-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";

    vi.clearAllMocks();
    tokenRow = {
      id: "tok-1",
      userId: USER_ID,
      tokenHash: sha256(RAW_TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: DB, useValue: mockDatabase },
        { provide: MAIL, useValue: { sendMail: vi.fn() } },
      ],
    }).compile();

    service = module.get(EmailVerificationService);
  });

  it("returns userId and marks token used on happy path", async () => {
    const result = await service.consumeToken(RAW_TOKEN);

    expect(result).toEqual({ userId: USER_ID });
    expect(tokenRow?.usedAt).toBeInstanceOf(Date);
    expect(mockDatabase.update).toHaveBeenCalled();
  });

  it("throws invalid_or_expired_token for unknown token", async () => {
    tokenRow = null;

    await expect(service.consumeToken("unknown-token")).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    await expect(service.consumeToken("unknown-token")).rejects.toMatchObject({
      reason: "invalid_or_expired_token",
    });
  });

  it("throws invalid_or_expired_token for expired token", async () => {
    tokenRow = {
      id: "tok-expired",
      userId: USER_ID,
      tokenHash: sha256(RAW_TOKEN),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    };

    await expect(service.consumeToken(RAW_TOKEN)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
  });

  it("throws invalid_or_expired_token for already-used token", async () => {
    tokenRow = {
      id: "tok-used",
      userId: USER_ID,
      tokenHash: sha256(RAW_TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
    };

    await expect(service.consumeToken(RAW_TOKEN)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
  });

  it("throws invalid_or_expired_token on second consume of same raw token", async () => {
    await service.consumeToken(RAW_TOKEN);

    await expect(service.consumeToken(RAW_TOKEN)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    await expect(service.consumeToken(RAW_TOKEN)).rejects.toMatchObject({
      reason: "invalid_or_expired_token",
    });
  });
});

describe("EmailVerificationService.consumeAndVerifyUser", () => {
  let service: EmailVerificationService;

  type TokenRow = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  };

  let tokenRow: TokenRow | null;
  let userExists: boolean;

  const mockDatabase = {
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "postgres://email-verification-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";

    vi.clearAllMocks();
    tokenRow = {
      id: "tok-1",
      userId: USER_ID,
      tokenHash: sha256(RAW_TOKEN),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    };
    userExists = true;

    mockDatabase.transaction.mockImplementation(async (fn) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => (tokenRow ? [tokenRow] : [])),
            })),
          })),
        })),
        update: vi.fn((table: unknown) => {
          if (table === emailVerificationTokens) {
            return {
              set: vi.fn((values: { usedAt: Date }) => ({
                where: vi.fn(async () => {
                  if (tokenRow) {
                    tokenRow.usedAt = values.usedAt;
                  }
                  return undefined;
                }),
              })),
            };
          }

          return {
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () =>
                  userExists
                    ? [
                        {
                          id: USER_ID,
                          email: EMAIL,
                          emailVerified: true,
                          displayName: "Ada",
                          dateOfBirth: "1990-01-01",
                        },
                      ]
                    : [],
                ),
              })),
            })),
          };
        }),
      };
      return fn(tx);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: DB, useValue: mockDatabase },
        { provide: MAIL, useValue: { sendMail: vi.fn() } },
      ],
    }).compile();

    service = module.get(EmailVerificationService);
  });

  it("marks user verified and burns token in one transaction", async () => {
    const result = await service.consumeAndVerifyUser(RAW_TOKEN);

    expect(result).toMatchObject({
      id: USER_ID,
      email: EMAIL,
      emailVerified: true,
    });
    expect(tokenRow?.usedAt).toBeInstanceOf(Date);
    expect(mockDatabase.transaction).toHaveBeenCalled();
  });

  it("throws invalid_or_expired_token when user row is missing", async () => {
    userExists = false;

    await expect(service.consumeAndVerifyUser(RAW_TOKEN)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
    expect(tokenRow?.usedAt).toBeNull();
  });

  it("throws invalid_or_expired_token for expired token", async () => {
    tokenRow = {
      id: "tok-expired",
      userId: USER_ID,
      tokenHash: sha256(RAW_TOKEN),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    };

    await expect(service.consumeAndVerifyUser(RAW_TOKEN)).rejects.toBeInstanceOf(
      InvalidOrExpiredTokenError,
    );
  });
});

describe("EmailVerificationService.countRecentResends", () => {
  let service: EmailVerificationService;

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ id: "1" }, { id: "2" }]),
      })),
    })),
  };

  beforeEach(async () => {
    process.env.DATABASE_URL ??= "postgres://email-verification-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";

    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: DB, useValue: mockDatabase },
        { provide: MAIL, useValue: { sendMail: vi.fn() } },
      ],
    }).compile();

    service = module.get(EmailVerificationService);
  });

  it("returns count of tokens created in the last hour", async () => {
    const count = await service.countRecentResends(USER_ID);
    expect(count).toBe(2);
    expect(mockDatabase.select).toHaveBeenCalled();
  });
});
