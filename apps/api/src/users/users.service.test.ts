import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { DB } from "../db/db.module.js";
import { AuditService } from "../audit/audit.service.js";
import { UsersService } from "./users.service.js";

describe("UsersService.updateProfile", () => {
  let service: UsersService;

  const row = {
    id: "u1",
    email: "a@example.com",
    emailVerified: true,
    displayName: "Sam",
    dateOfBirth: "1990-01-01",
  };

  const setSpy = vi.fn();
  const mockDatabase = {
    update: vi.fn(() => ({
      set: setSpy.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [row]),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [row]),
        })),
      })),
    })),
  };

  const mockAudit = { append: vi.fn(async () => undefined) };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DB, useValue: mockDatabase },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it("updates the display name and returns the /me shape", async () => {
    const result = await service.updateProfile("u1", { displayName: "Sam" });

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Sam" }),
    );
    expect(result).toMatchObject({
      id: "u1",
      displayName: "Sam",
      couple: null,
    });
  });

  it("audits without the name in metadata", async () => {
    await service.updateProfile("u1", { displayName: "Sam" });

    expect(mockAudit.append).toHaveBeenCalledWith({
      actorUserId: "u1",
      action: "user.update_profile",
      entityType: "user",
      entityId: "u1",
    });
  });

  it("throws NotFound when the user no longer exists", async () => {
    mockDatabase.update.mockReturnValueOnce({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => []) })),
      })),
    });

    await expect(
      service.updateProfile("missing", { displayName: "Sam" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
