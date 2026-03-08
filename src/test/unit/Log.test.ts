import { LogCacheService } from "../../app/app-services/logs/LogCache.service";
import { ILog } from "../../app/interfaces/Log.port";
import { CreateLog } from "../../app/use-cases/commands/logs/CreateLog.command";
import { Log } from "../../domain/aggregates/Log";

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

describe("Log aggregate", () => {
  it("creates a log with required fields", () => {
    const log = Log.create({
      source: "http",
      level: "error",
      category: "security",
      message: "Unauthorized",
      userId: "11111111-1111-4111-8111-111111111111",
      requestId: "req-1",
      statusCode: 401,
      context: { key: "value" },
    });

    expect(log.source).toBe("http");
    expect(log.level).toBe("error");
    expect(log.category).toBe("security");
    expect(log.message).toBe("Unauthorized");
    expect(log.userId).toBe("11111111-1111-4111-8111-111111111111");
    expect(log.statusCode).toBe(401);
    expect(log.context).toEqual({ key: "value" });
    expect(log.occurredAt).toBeInstanceOf(Date);
  });

  it("resolves log", () => {
    const log = Log.create({
      source: "service",
      level: "warn",
      category: "application",
      message: "Something happened",
    });

    log.resolve("22222222-2222-4222-8222-222222222222", new Date("2025-01-01T00:00:00.000Z"));
    expect(log.resolvedBy).toBe("22222222-2222-4222-8222-222222222222");
    expect(log.resolvedAt?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("throws on invalid source", () => {
    assertDomainErrorCode(
      () =>
        Log.create({
          source: " ",
          level: "error",
          category: "security",
          message: "x",
        }),
      "PRESENTATION.INVALID_FIELD",
    );
  });

  it("throws on invalid status code", () => {
    assertDomainErrorCode(
      () =>
        Log.create({
          source: "http",
          level: "error",
          category: "security",
          message: "x",
          statusCode: 700,
        }),
      "PRESENTATION.INVALID_FIELD",
    );
  });
});

describe("CreateLog command", () => {
  it("redacts sensitive context and invalidates cache", async () => {
    const saved = Log.create({
      id: "1",
      source: "http",
      level: "error",
      category: "security",
      message: "Unauthorized",
      context: { token: "[redacted]" },
    });

    const repo: Pick<ILog, "save"> = {
      save: jest.fn(async () => saved),
    };
    const cache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as LogCacheService;

    const command = new CreateLog(repo as ILog, cache);
    const result = await command.execute({
      source: "http",
      level: "error",
      category: "security",
      message: "Unauthorized",
      context: { token: "secret-token", nested: { password: "123" } },
    });

    expect(result.id).toBe(saved.id);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const payload = (repo.save as jest.Mock).mock.calls[0][0] as Log;
    expect(payload.context).toEqual({
      token: "[redacted]",
      nested: { password: "[redacted]" },
    });
    expect(cache.invalidateForMutation).toHaveBeenCalledWith(saved.id);
  });

  it("auto-resolves info logs on creation", async () => {
    const repo: Pick<ILog, "save"> = {
      save: jest.fn(async (log) => log),
    };
    const cache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as LogCacheService;

    const command = new CreateLog(repo as ILog, cache);
    const occurredAt = new Date("2026-03-08T10:00:00.000Z");
    const result = await command.execute({
      source: "http",
      level: "info",
      category: "audit",
      message: "Resource updated",
      occurredAt,
    });

    expect(result.level).toBe("info");
    expect(result.resolvedAt?.toISOString()).toBe("2026-03-08T10:00:00.000Z");
    expect(result.resolvedBy).toBeNull();
  });
});
