import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { TokenService } from "../token/token.service.js";
import { AuthService } from "./auth.service.js";

describe("AuthService.register", () => {
  let service: AuthService;

  const mockDatabase = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
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

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
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

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DB, useValue: mockDatabase },
        { provide: TokenService, useValue: mockTokens },
        { provide: AuditService, useValue: mockAudit },
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
