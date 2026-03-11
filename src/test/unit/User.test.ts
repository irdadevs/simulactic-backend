import { IHasher } from "../../app/interfaces/Hasher.port";
import { ISession } from "../../app/interfaces/Session.port";
import { IUser, UserListItem } from "../../app/interfaces/User.port";
import { UserCacheService } from "../../app/app-services/users/UserCache.service";
import { ChangePassword } from "../../app/use-cases/commands/users/ChangePassword.command";
import { CreateAdmin } from "../../app/use-cases/commands/users/CreateAdmin.command";
import { LoginUser } from "../../app/use-cases/commands/users/LoginUser.command";
import { User, Uuid } from "../../domain/aggregates/User";

const validInput = {
  email: "test@example.com",
  passwordHash: "hashed-password-123",
  username: "user_01",
};

const assertDomainErrorCode = (fn: () => void, code: string) => {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }

  expect(thrown).toBeDefined();

  const error = thrown as { code?: string };
  expect(error.code).toBe(code);
};

describe("User aggregate", () => {
  it("creates a user with defaults", () => {
    const user = User.create(validInput);

    expect(Uuid.isValid(user.id)).toBe(true);
    expect(user.email).toBe(validInput.email);
    expect(user.passwordHash).toBe(validInput.passwordHash);
    expect(user.username).toBe(validInput.username);
    expect(user.isVerified).toBe(false);
    expect(user.verificationCode).toBeNull();
    expect(user.verificationCodeExpiresAt).toBeNull();
    expect(user.verifiedAt).toBeNull();
    expect(user.isDeleted).toBe(false);
    expect(user.isArchived).toBe(false);
    expect(user.isSupporter).toBe(false);
    expect(user.supporterFrom).toBeNull();
    expect(user.deletedAt).toBeNull();
    expect(user.archivedAt).toBeNull();
    expect(user.lastActivityAt).toBeInstanceOf(Date);
    expect(user.role).toBe("User");
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("creates a user with provided fields", () => {
    const user = User.create({
      ...validInput,
      id: "11111111-1111-4111-8111-111111111111",
      role: "Admin",
      isVerified: true,
      verificationCode: "verification-hash-12345678",
      verificationCodeExpiresAt: new Date("2025-01-01T11:30:00.000Z"),
      verifiedAt: new Date("2025-01-01T12:00:00.000Z"),
      isDeleted: true,
      deletedAt: new Date("2025-01-02T00:00:00.000Z"),
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    expect(user.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(user.role).toBe("Admin");
    expect(user.isVerified).toBe(true);
    expect(user.verificationCode).toBe("verification-hash-12345678");
    expect(user.verificationCodeExpiresAt?.toISOString()).toBe("2025-01-01T11:30:00.000Z");
    expect(user.verifiedAt?.toISOString()).toBe("2025-01-01T12:00:00.000Z");
    expect(user.isDeleted).toBe(true);
    expect(user.isArchived).toBe(false);
    expect(user.isSupporter).toBe(false);
    expect(user.supporterFrom).toBeNull();
    expect(user.deletedAt?.toISOString()).toBe("2025-01-02T00:00:00.000Z");
    expect(user.archivedAt).toBeNull();
    expect(user.createdAt.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("throws on invalid id", () => {
    assertDomainErrorCode(
      () =>
        User.create({
          ...validInput,
          id: "not-a-uuid",
        }),
      "DOMAIN.INVALID_USER_ID",
    );
  });

  it("throws on invalid email", () => {
    assertDomainErrorCode(
      () =>
        User.create({
          ...validInput,
          email: "not-an-email",
        }),
      "DOMAIN.INVALID_USER_EMAIL",
    );
  });

  it("throws on invalid password hash", () => {
    assertDomainErrorCode(
      () =>
        User.create({
          ...validInput,
          passwordHash: "short",
        }),
      "DOMAIN.INVALID_USER_PASSWORD",
    );
  });

  it("throws on invalid username", () => {
    assertDomainErrorCode(
      () =>
        User.create({
          ...validInput,
          username: "a",
        }),
      "DOMAIN.INVALID_USER_USERNAME",
    );
  });

  it("throws on invalid role", () => {
    assertDomainErrorCode(
      () =>
        User.create({
          ...validInput,
          role: "Root" as "Admin",
        }),
      "DOMAIN.INVALID_USER_ROLE",
    );
  });

  it("verifies email idempotently", () => {
    const user = User.create(validInput);

    user.verifyEmail();
    user.verifyEmail();

    expect(user.isVerified).toBe(true);
    expect(user.verifiedAt).toBeInstanceOf(Date);
    expect(user.verificationCode).toBeNull();
    expect(user.verificationCodeExpiresAt).toBeNull();
  });

  it("sets verification code and marks user as pending verification", () => {
    const user = User.create(validInput);

    user.setVerificationCode(
      "hashed-verification-code-12345678",
      new Date("2025-01-01T11:30:00.000Z"),
    );

    expect(user.verificationCode).toBe("hashed-verification-code-12345678");
    expect(user.verificationCodeExpiresAt?.toISOString()).toBe("2025-01-01T11:30:00.000Z");
    expect(user.isVerified).toBe(false);
    expect(user.verifiedAt).toBeNull();
  });

  it("changes email when different", () => {
    const user = User.create(validInput);

    user.changeEmail("next@example.com");

    expect(user.email).toBe("next@example.com");
  });

  it("keeps email when unchanged", () => {
    const user = User.create(validInput);

    user.changeEmail(validInput.email);

    expect(user.email).toBe(validInput.email);
  });

  it("changes password hash when different", () => {
    const user = User.create(validInput);

    user.changePasswordHash("another-hash-123");

    expect(user.passwordHash).toBe("another-hash-123");
  });

  it("keeps password hash when unchanged", () => {
    const user = User.create(validInput);

    user.changePasswordHash(validInput.passwordHash);

    expect(user.passwordHash).toBe(validInput.passwordHash);
  });

  it("changes username when different", () => {
    const user = User.create(validInput);

    user.changeUsername("new_user");

    expect(user.username).toBe("new_user");
  });

  it("keeps username when unchanged", () => {
    const user = User.create(validInput);

    user.changeUsername(validInput.username);

    expect(user.username).toBe(validInput.username);
  });

  it("changes role when different", () => {
    const user = User.create(validInput);

    user.changeRole("Admin");

    expect(user.role).toBe("Admin");
  });

  it("keeps role when unchanged", () => {
    const user = User.create(validInput);

    user.changeRole("User");

    expect(user.role).toBe("User");
  });

  it("soft deletes and restores", () => {
    const user = User.create(validInput);

    user.softDelete(new Date("2025-01-03T00:00:00.000Z"));

    expect(user.isDeleted).toBe(true);
    expect(user.deletedAt?.toISOString()).toBe("2025-01-03T00:00:00.000Z");

    user.restore();

    expect(user.isDeleted).toBe(false);
    expect(user.deletedAt).toBeNull();
  });

  it("archives user and keeps deleted=true", () => {
    const user = User.create(validInput);

    user.archive(new Date("2025-01-04T00:00:00.000Z"));

    expect(user.isArchived).toBe(true);
    expect(user.archivedAt?.toISOString()).toBe("2025-01-04T00:00:00.000Z");
    expect(user.isDeleted).toBe(true);
    expect(user.deletedAt?.toISOString()).toBe("2025-01-04T00:00:00.000Z");
  });

  it("unarchives user and restores active flags", () => {
    const user = User.create(validInput);
    user.archive(new Date("2025-01-04T00:00:00.000Z"));

    user.unarchive(new Date("2025-01-06T00:00:00.000Z"));

    expect(user.isArchived).toBe(false);
    expect(user.archivedAt).toBeNull();
    expect(user.isDeleted).toBe(false);
    expect(user.deletedAt).toBeNull();
    expect(user.lastActivityAt.toISOString()).toBe("2025-01-06T00:00:00.000Z");
  });

  it("touches activity timestamp", () => {
    const user = User.create(validInput);
    user.touchActivity(new Date("2025-01-05T00:00:00.000Z"));
    expect(user.lastActivityAt.toISOString()).toBe("2025-01-05T00:00:00.000Z");
  });

  it("marks supporter and keeps first supporter date", () => {
    const user = User.create(validInput);
    const from = new Date("2025-01-05T00:00:00.000Z");
    user.markSupporter(from);
    user.markSupporter(new Date("2025-02-01T00:00:00.000Z"));

    expect(user.isSupporter).toBe(true);
    expect(user.supporterFrom?.toISOString()).toBe("2025-01-05T00:00:00.000Z");
  });

  it("rehydrates from persistence data", () => {
    const user = User.rehydrate({
      id: "22222222-2222-4222-8222-222222222222",
      email: "rehydrated@example.com",
      passwordHash: "rehydrated-hash-123",
      username: "rehydrated_user",
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verifiedAt: new Date("2024-06-01T12:00:00.000Z"),
      isDeleted: true,
      isArchived: true,
      isSupporter: true,
      supporterFrom: new Date("2024-06-01T09:00:00.000Z"),
      deletedAt: new Date("2024-06-02T10:00:00.000Z"),
      archivedAt: new Date("2024-06-03T10:00:00.000Z"),
      lastActivityAt: new Date("2024-06-04T10:00:00.000Z"),
      createdAt: new Date("2024-06-01T10:00:00.000Z"),
      role: "User",
    });

    expect(user.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(user.email).toBe("rehydrated@example.com");
    expect(user.passwordHash).toBe("rehydrated-hash-123");
    expect(user.username).toBe("rehydrated_user");
    expect(user.isVerified).toBe(true);
    expect(user.verifiedAt?.toISOString()).toBe("2024-06-01T12:00:00.000Z");
    expect(user.verificationCode).toBeNull();
    expect(user.verificationCodeExpiresAt).toBeNull();
    expect(user.isDeleted).toBe(true);
    expect(user.isArchived).toBe(true);
    expect(user.isSupporter).toBe(true);
    expect(user.supporterFrom?.toISOString()).toBe("2024-06-01T09:00:00.000Z");
    expect(user.deletedAt?.toISOString()).toBe("2024-06-02T10:00:00.000Z");
    expect(user.archivedAt?.toISOString()).toBe("2024-06-03T10:00:00.000Z");
    expect(user.lastActivityAt?.toISOString()).toBe("2024-06-04T10:00:00.000Z");
    expect(user.role).toBe("User");
  });

  it("maps to DB DTO", () => {
    const user = User.create(validInput);

    const dto = user.toDB();

    expect(dto).toEqual({
      id: user.id,
      email: user.email,
      username: user.username,
      password: user.passwordHash,
      is_verified: user.isVerified,
      verification_code: user.verificationCode,
      verification_code_expires_at: user.verificationCodeExpiresAt,
      verified_at: user.verifiedAt,
      is_deleted: user.isDeleted,
      is_archived: user.isArchived,
      is_supporter: user.isSupporter,
      supporter_from: user.supporterFrom,
      deleted_at: user.deletedAt,
      archived_at: user.archivedAt,
      last_activity_at: user.lastActivityAt,
      created_at: user.createdAt,
      role: user.role,
    });
  });
});

describe("LoginUser command", () => {
  it("auto-unarchives archived users on successful login", async () => {
    const archived = User.create({
      id: "11111111-1111-4111-8111-111111111111",
      email: "archived@test.com",
      passwordHash: "hashed-password-123",
      username: "archived_user",
      isVerified: true,
      isDeleted: true,
      isArchived: true,
      deletedAt: new Date("2025-01-01T00:00:00.000Z"),
      archivedAt: new Date("2025-01-01T00:00:00.000Z"),
      lastActivityAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    const repo: IUser = {
      save: jest.fn(async (u): Promise<User> => u),
      findById: jest.fn(async (): Promise<User | null> => null),
      findByEmail: jest.fn(async (): Promise<User | null> => archived),
      findByUsername: jest.fn(async (): Promise<User | null> => null),
      list: jest.fn(
        async (): Promise<{ rows: UserListItem[]; total: number }> => ({
          rows: [],
          total: 0,
        }),
      ),
      changeEmail: jest.fn(async (): Promise<User> => archived),
      changePassword: jest.fn(async (): Promise<User> => archived),
      changeUsername: jest.fn(async (): Promise<User> => archived),
      changeRole: jest.fn(async (): Promise<User> => archived),
      verify: jest.fn(async (): Promise<void> => undefined),
      softDelete: jest.fn(async (): Promise<void> => undefined),
      restore: jest.fn(async (): Promise<void> => undefined),
      touchActivity: jest.fn(async (): Promise<void> => undefined),
      archiveInactive: jest.fn(
        async (): Promise<Array<{ id: string; email: string; username: string }>> => [],
      ),
    };

    const hasher: IHasher = {
      hash: jest.fn(async () => "hash"),
      compare: jest.fn(async () => true),
    };

    const command = new LoginUser(repo, hasher);
    const result = await command.execute({
      email: "archived@test.com",
      rawPassword: "123456",
    });

    expect(result.isArchived).toBe(false);
    expect(result.isDeleted).toBe(false);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe("CreateAdmin command", () => {
  it("creates a verified admin without verification code lifecycle", async () => {
    const repo: IUser = {
      save: jest.fn(async (u): Promise<User> => u),
      findById: jest.fn(async (): Promise<User | null> => null),
      findByEmail: jest.fn(async (): Promise<User | null> => null),
      findByUsername: jest.fn(async (): Promise<User | null> => null),
      list: jest.fn(
        async (): Promise<{ rows: UserListItem[]; total: number }> => ({
          rows: [],
          total: 0,
        }),
      ),
      changeEmail: jest.fn(async (): Promise<User> => User.create(validInput)),
      changePassword: jest.fn(async (): Promise<User> => User.create(validInput)),
      changeUsername: jest.fn(async (): Promise<User> => User.create(validInput)),
      changeRole: jest.fn(async (): Promise<User> => User.create(validInput)),
      verify: jest.fn(async (): Promise<void> => undefined),
      softDelete: jest.fn(async (): Promise<void> => undefined),
      restore: jest.fn(async (): Promise<void> => undefined),
      touchActivity: jest.fn(async (): Promise<void> => undefined),
      archiveInactive: jest.fn(
        async (): Promise<Array<{ id: string; email: string; username: string }>> => [],
      ),
    };

    const hasher: IHasher = {
      hash: jest.fn(async () => "hashed-admin-password-123"),
      compare: jest.fn(async () => true),
    };

    const userCache = {
      setUser: jest.fn(async (): Promise<void> => undefined),
      invalidateList: jest.fn(async (): Promise<void> => undefined),
    } as unknown as UserCacheService;

    const command = new CreateAdmin(repo, hasher, userCache);
    const user = await command.execute({
      email: "new-admin@test.com",
      username: "new_admin",
      rawPassword: "Passw0rd!123",
    });

    expect(hasher.hash).toHaveBeenCalledWith("Passw0rd!123");
    expect(user.role).toBe("Admin");
    expect(user.isVerified).toBe(true);
    expect(user.verifiedAt).toBeInstanceOf(Date);
    expect(user.verificationCode).toBeNull();
    expect(user.verificationCodeExpiresAt).toBeNull();
    expect(repo.save).toHaveBeenCalledWith(user);
    expect(userCache.setUser).toHaveBeenCalledWith(user);
    expect(userCache.invalidateList).toHaveBeenCalled();
  });
});

describe("ChangePassword command", () => {
  it("returns not found when user does not exist", async () => {
    const repo: IUser = {
      save: jest.fn(async (u): Promise<User> => u),
      findById: jest.fn(async (): Promise<User | null> => null),
      findByEmail: jest.fn(async (): Promise<User | null> => null),
      findByUsername: jest.fn(async (): Promise<User | null> => null),
      list: jest.fn(
        async (): Promise<{ rows: UserListItem[]; total: number }> => ({
          rows: [],
          total: 0,
        }),
      ),
      changeEmail: jest.fn(async (): Promise<User> => User.create(validInput)),
      changePassword: jest.fn(async (): Promise<User> => User.create(validInput)),
      changeUsername: jest.fn(async (): Promise<User> => User.create(validInput)),
      changeRole: jest.fn(async (): Promise<User> => User.create(validInput)),
      verify: jest.fn(async (): Promise<void> => undefined),
      softDelete: jest.fn(async (): Promise<void> => undefined),
      restore: jest.fn(async (): Promise<void> => undefined),
      touchActivity: jest.fn(async (): Promise<void> => undefined),
      archiveInactive: jest.fn(
        async (): Promise<Array<{ id: string; email: string; username: string }>> => [],
      ),
    };

    const hasher: IHasher = {
      hash: jest.fn(async () => "new-hash-123"),
      compare: jest.fn(async () => true),
    };

    const sessionRepo: ISession = {
      create: jest.fn(async (): Promise<void> => undefined),
      save: jest.fn(async (): Promise<void> => undefined),
      findById: jest.fn(async (): Promise<null> => null),
      revoke: jest.fn(async (): Promise<void> => undefined),
      revokeAllForUser: jest.fn(async (): Promise<void> => undefined),
      updateRefreshTokenHash: jest.fn(async (): Promise<void> => undefined),
    };

    const userCache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as UserCacheService;

    const command = new ChangePassword(repo, hasher, sessionRepo, userCache);

    await expect(
      command.execute(Uuid.create("66666666-6666-4666-8666-666666666666"), {
        currentPassword: "current-pass-123",
        newPassword: "new-pass-456",
      }),
    ).rejects.toMatchObject({ code: "SHARED.NOT_FOUND" });

    expect(hasher.compare).not.toHaveBeenCalled();
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(userCache.invalidateForMutation).not.toHaveBeenCalled();
    expect(sessionRepo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("rejects when current password is invalid", async () => {
    const user = User.create({
      id: "44444444-4444-4444-8444-444444444444",
      email: "change@test.com",
      passwordHash: "stored-hash-123",
      username: "change_user",
      isVerified: true,
    });

    const repo: IUser = {
      save: jest.fn(async (u): Promise<User> => u),
      findById: jest.fn(async (): Promise<User | null> => user),
      findByEmail: jest.fn(async (): Promise<User | null> => null),
      findByUsername: jest.fn(async (): Promise<User | null> => null),
      list: jest.fn(
        async (): Promise<{ rows: UserListItem[]; total: number }> => ({
          rows: [],
          total: 0,
        }),
      ),
      changeEmail: jest.fn(async (): Promise<User> => user),
      changePassword: jest.fn(async (): Promise<User> => user),
      changeUsername: jest.fn(async (): Promise<User> => user),
      changeRole: jest.fn(async (): Promise<User> => user),
      verify: jest.fn(async (): Promise<void> => undefined),
      softDelete: jest.fn(async (): Promise<void> => undefined),
      restore: jest.fn(async (): Promise<void> => undefined),
      touchActivity: jest.fn(async (): Promise<void> => undefined),
      archiveInactive: jest.fn(
        async (): Promise<Array<{ id: string; email: string; username: string }>> => [],
      ),
    };

    const hasher: IHasher = {
      hash: jest.fn(async () => "new-hash-123"),
      compare: jest.fn(async () => false),
    };

    const sessionRepo: ISession = {
      create: jest.fn(async (): Promise<void> => undefined),
      save: jest.fn(async (): Promise<void> => undefined),
      findById: jest.fn(async (): Promise<null> => null),
      revoke: jest.fn(async (): Promise<void> => undefined),
      revokeAllForUser: jest.fn(async (): Promise<void> => undefined),
      updateRefreshTokenHash: jest.fn(async (): Promise<void> => undefined),
    };

    const userCache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as UserCacheService;

    const command = new ChangePassword(repo, hasher, sessionRepo, userCache);

    await expect(
      command.execute(Uuid.create(user.id), {
        currentPassword: "wrong-password",
        newPassword: "new-pass-123",
      }),
    ).rejects.toMatchObject({ code: "AUTH.INVALID_CREDENTIALS" });

    expect(hasher.compare).toHaveBeenCalledWith("wrong-password", user.passwordHash);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(userCache.invalidateForMutation).not.toHaveBeenCalled();
    expect(sessionRepo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("changes password when current password is valid", async () => {
    const user = User.create({
      id: "55555555-5555-4555-8555-555555555555",
      email: "change-ok@test.com",
      passwordHash: "stored-hash-123",
      username: "change_ok_user",
      isVerified: true,
    });

    const repo: IUser = {
      save: jest.fn(async (u): Promise<User> => u),
      findById: jest.fn(async (): Promise<User | null> => user),
      findByEmail: jest.fn(async (): Promise<User | null> => null),
      findByUsername: jest.fn(async (): Promise<User | null> => null),
      list: jest.fn(
        async (): Promise<{ rows: UserListItem[]; total: number }> => ({
          rows: [],
          total: 0,
        }),
      ),
      changeEmail: jest.fn(async (): Promise<User> => user),
      changePassword: jest.fn(async (): Promise<User> => user),
      changeUsername: jest.fn(async (): Promise<User> => user),
      changeRole: jest.fn(async (): Promise<User> => user),
      verify: jest.fn(async (): Promise<void> => undefined),
      softDelete: jest.fn(async (): Promise<void> => undefined),
      restore: jest.fn(async (): Promise<void> => undefined),
      touchActivity: jest.fn(async (): Promise<void> => undefined),
      archiveInactive: jest.fn(
        async (): Promise<Array<{ id: string; email: string; username: string }>> => [],
      ),
    };

    const hasher: IHasher = {
      hash: jest.fn(async () => "new-hash-456"),
      compare: jest.fn(async () => true),
    };

    const sessionRepo: ISession = {
      create: jest.fn(async (): Promise<void> => undefined),
      save: jest.fn(async (): Promise<void> => undefined),
      findById: jest.fn(async (): Promise<null> => null),
      revoke: jest.fn(async (): Promise<void> => undefined),
      revokeAllForUser: jest.fn(async (): Promise<void> => undefined),
      updateRefreshTokenHash: jest.fn(async (): Promise<void> => undefined),
    };

    const userCache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as UserCacheService;

    const command = new ChangePassword(repo, hasher, sessionRepo, userCache);

    const result = await command.execute(Uuid.create(user.id), {
      currentPassword: "current-pass-123",
      newPassword: "new-pass-456",
    });

    expect(result).toBe(true);
    expect(hasher.compare).toHaveBeenCalledWith("current-pass-123", "stored-hash-123");
    expect(hasher.hash).toHaveBeenCalledWith("new-pass-456");
    expect(user.passwordHash).toBe("new-hash-456");
    expect(repo.save).toHaveBeenCalledWith(user);
    expect(userCache.invalidateForMutation).toHaveBeenCalledWith(user);
    expect(sessionRepo.revokeAllForUser).toHaveBeenCalledWith(user.id);
  });
});
