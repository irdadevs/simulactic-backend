import { createHash } from "crypto";
import { CreateLogInput, ILog } from "../../../interfaces/Log.port";
import { Log } from "../../../../domain/aggregates/Log";
import { LogCacheService } from "../../../app-services/logs/LogCache.service";

const REDACTED = "[redacted]";
const SENSITIVE_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "refresh",
  "access",
] as const;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = redactValue(val);
    }
    return out;
  }
  return value;
}

function normalizeContext(input?: Record<string, unknown>): Record<string, unknown> {
  if (!input) return {};
  const redacted = redactValue(input) as Record<string, unknown>;
  const asString = JSON.stringify(redacted);
  if (asString.length <= 20_000) return redacted;
  return { truncated: true, preview: asString.slice(0, 20_000) };
}

function buildFingerprint(input: CreateLogInput): string {
  const raw = `${input.source}|${input.level}|${input.category}|${input.message}|${input.method ?? ""}|${input.path ?? ""}|${input.statusCode ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

export class CreateLog {
  constructor(
    private readonly repo: ILog,
    private readonly cache: LogCacheService,
  ) {}

  async execute(input: CreateLogInput): Promise<Log> {
    const occurredAt = input.occurredAt ?? new Date();
    const resolvedAt = input.level === "info" ? occurredAt : undefined;

    const log = Log.create({
      ...input,
      occurredAt,
      resolvedAt,
      message: input.message.slice(0, 1000),
      context: normalizeContext(input.context),
      fingerprint: input.fingerprint ?? buildFingerprint(input),
      tags: input.tags?.slice(0, 20),
    });

    const saved = await this.repo.save(log);
    await this.cache.invalidateForMutation(saved.id);
    return saved;
  }
}
