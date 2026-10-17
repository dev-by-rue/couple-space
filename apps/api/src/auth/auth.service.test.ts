import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  HttpException,
} from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { TokenService } from "../token/token.service.js";
import {
  EmailVerificationService,
  InvalidOrExpiredTokenError,
} from "./email-verification.service.js";
import { AuthService } from "./auth.service.js";
import { users } from "@couple-space/database";

describe("AuthService.register", () => {
  let service: AuthService;

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(
            async (): Promise<
              Pick<typeof users.$inferSelect, "id" | "email">[]
            > => [],
          ),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [
          {
            id: "u1",
            email: "a@example.com",
            emailVerified: false,
            displayName: "Ada",
            dateOfBirth: "1990-01-01",
          },
        ]),
      })),
    })),
  };

  const mockTokens = {
    issueTokenPair: vi.fn(async () => ({
      accessToken: "access",
      refreshToken: "refresh",
    })),
  };

  const mockAudit = {
    append: vi.fn(async () => undefined),
  };

  const mockEmailVerification = {
    sendVerificationEmail: vi.fn(async () => undefined),
    consumeToken: vi.fn(),
    consumeAndVerifyUser: vi.fn(),
    countRecentResends: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.DATABASE_URL ??= "postgres://auth-service-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";
    process.env.EMAIL_VERIFY_RESEND_PER_HOUR = "5";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerification,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("creates user with emailVerified false and issues tokens", async () => {
    const result = await service.register({
      email: "a@example.com",
      password: "CorrectHorse1!",
      displayName: "Ada",
      dateOfBirth: "1990-01-01",
    });

    expect(result.user.emailVerified).toBe(false);
    expect(result.accessToken).toBe("access");
    expect(mockAudit.append).toHaveBeenCalled();
    expect(mockEmailVerification.sendVerificationEmail).toHaveBeenCalledWith(
      "u1",
      "a@example.com",
    );
  });

  it("rejects duplicate email with email_taken", async () => {
    mockDatabase.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "existing",
              email: "a@example.com",
            },
          ]),
        })),
      })),
    });

    await expect(
      service.register({
        email: "a@example.com",
        password: "CorrectHorse1!",
        displayName: "Ada",
        dateOfBirth: "1990-01-01",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("still returns user when verification email send fails", async () => {
    mockEmailVerification.sendVerificationEmail.mockRejectedValueOnce(
      new Error("smtp down"),
    );

    const result = await service.register({
      email: "a@example.com",
      password: "CorrectHorse1!",
      displayName: "Ada",
      dateOfBirth: "1990-01-01",
    });

    expect(result.user.emailVerified).toBe(false);
    expect(result.accessToken).toBe("access");
  });
});

describe("AuthService.devVerify", () => {
  let service: AuthService;

  const mockDatabase = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [
            {
              id: "u1",
              email: "a@example.com",
              emailVerified: true,
              displayName: "Ada",
              dateOfBirth: "1990-01-01",
            },
          ]),
        })),
      })),
    })),
  };

  const mockTokens = {
    issueTokenPair: vi.fn(async () => ({
      accessToken: "access-verified",
      refreshToken: "refresh-verified",
    })),
  };

  const mockAudit = {
    append: vi.fn(async () => undefined),
  };

  const mockEmailVerification = {
    sendVerificationEmail: vi.fn(),
    consumeToken: vi.fn(),
    consumeAndVerifyUser: vi.fn(),
    countRecentResends: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerification,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("marks email verified and re-issues tokens with emailVerified true", async () => {
    const result = await service.devVerify("u1");

    expect(result.user.emailVerified).toBe(true);
    expect(result.accessToken).toBe("access-verified");
    expect(result.refreshToken).toBe("refresh-verified");
    expect(mockTokens.issueTokenPair).toHaveBeenCalledWith({
      id: "u1",
      email: "a@example.com",
      emailVerified: true,
    });
  });
});

describe("AuthService.verifyEmail", () => {
  let service: AuthService;

  const mockTokens = {
    issueTokenPair: vi.fn(async () => ({
      accessToken: "access-verified",
      refreshToken: "refresh-verified",
    })),
  };

  const mockAudit = {
    append: vi.fn(async () => undefined),
  };

  const verifiedUser = {
    id: "u1",
    email: "a@example.com",
    emailVerified: true,
    displayName: "Ada",
    dateOfBirth: "1990-01-01",
  };

  const mockEmailVerification = {
    sendVerificationEmail: vi.fn(),
    consumeToken: vi.fn(),
    consumeAndVerifyUser: vi.fn(async () => verifiedUser),
    countRecentResends: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: {} },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerification,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("sets email verified and returns token pair with emailVerified true", async () => {
    const result = await service.verifyEmail("raw-token");

    expect(result.user.emailVerified).toBe(true);
    expect(result.accessToken).toBe("access-verified");
    expect(mockEmailVerification.consumeAndVerifyUser).toHaveBeenCalledWith(
      "raw-token",
    );
    expect(mockTokens.issueTokenPair).toHaveBeenCalledWith({
      id: "u1",
      email: "a@example.com",
      emailVerified: true,
    });
    expect(mockAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.verify_email" }),
    );
  });

  it("throws BadRequest with invalid_or_expired_token for invalid token", async () => {
    mockEmailVerification.consumeAndVerifyUser.mockRejectedValue(
      new InvalidOrExpiredTokenError(),
    );

    const error = await service.verifyEmail("bad-token").catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error).toMatchObject({
      response: { reason: "invalid_or_expired_token" },
    });
  });
});

describe("AuthService.resendVerification", () => {
  let service: AuthService;

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "u1",
              email: "a@example.com",
              emailVerified: false,
              displayName: "Ada",
              dateOfBirth: "1990-01-01",
            },
          ]),
        })),
      })),
    })),
  };

  const mockTokens = {
    issueTokenPair: vi.fn(),
  };

  const mockAudit = {
    append: vi.fn(async () => undefined),
  };

  const mockEmailVerification = {
    sendVerificationEmail: vi.fn(async () => undefined),
    consumeToken: vi.fn(),
    consumeAndVerifyUser: vi.fn(),
    countRecentResends: vi.fn(async () => 0),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.DATABASE_URL ??= "postgres://auth-service-test";
    process.env.JWT_SECRET ??= "test-secret-at-least-32-characters-long";
    process.env.EMAIL_VERIFY_RESEND_PER_HOUR = "5";
    mockEmailVerification.countRecentResends.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerification,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it("sends verification email when user is unverified", async () => {
    const result = await service.resendVerification("u1");

    expect(result).toEqual({ ok: true });
    expect(mockEmailVerification.sendVerificationEmail).toHaveBeenCalledWith(
      "u1",
      "a@example.com",
    );
    expect(mockAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.resend_verification" }),
    );
  });

  it("returns alreadyVerified when user is already verified", async () => {
    mockDatabase.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "u1",
              email: "a@example.com",
              emailVerified: true,
              displayName: "Ada",
              dateOfBirth: "1990-01-01",
            },
          ]),
        })),
      })),
    });

    const result = await service.resendVerification("u1");

    expect(result).toEqual({ ok: true, alreadyVerified: true });
    expect(mockEmailVerification.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("throws 429 when resend rate limit exceeded", async () => {
    mockEmailVerification.countRecentResends.mockResolvedValue(5);

    const error = await service.resendVerification("u1").catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({
      response: { reason: "resend_rate_limited" },
      status: 429,
    });
    expect(mockEmailVerification.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns ok with sent false when verification email send fails", async () => {
    mockEmailVerification.sendVerificationEmail.mockRejectedValueOnce(
      new Error("smtp down"),
    );

    const result = await service.resendVerification("u1");

    expect(result).toEqual({ ok: true, sent: false });
    expect(mockAudit.append).not.toHaveBeenCalled();
  });
});
