import { ListLogsQuery } from "../../app/interfaces/Log.port";
import { Log, LogCategory, LogLevel } from "../../domain/aggregates/Log";
import { TTL_MAP } from "../TTL.map";

export type CachedLog = {
  id: string;
  source: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context: Record<string, unknown>;
  userId: string | null;
  requestId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ip: string | null;
  userAgent: string | null;
  fingerprint: string | null;
  tags: string[];
  occurredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  adminNoteUpdatedBy: string | null;
};

export type CachedListLogsResult = {
  rows: CachedLog[];
  total: number;
};

export const LOG_CACHE_POLICY = {
  logTtl: TTL_MAP.oneHour,
  logsListTtl: TTL_MAP.fiveMinutes,
} as const;

const LOGS_PREFIX = "logs";
const LOGS_LIST_PREFIX = `${LOGS_PREFIX}:list`;

export const LogCacheKeys = {
  byId: (id: string): string => `${LOGS_PREFIX}:by-id:${id}`,
  listPrefix: (): string => LOGS_LIST_PREFIX,
  list: (query: ListLogsQuery): string =>
    `${LOGS_LIST_PREFIX}:${JSON.stringify(normalizeListQuery(query))}`,
};

function normalizeListQuery(query: ListLogsQuery): ListLogsQuery {
  return {
    ...query,
    source: query.source?.trim(),
    requestId: query.requestId?.trim(),
    userId: query.userId?.trim(),
    search: query.search?.trim(),
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}

export function serializeLogForCache(log: Log): CachedLog {
  const json = log.toJSON();
  return {
    ...json,
    occurredAt: json.occurredAt.toISOString(),
    resolvedAt: json.resolvedAt ? json.resolvedAt.toISOString() : null,
    adminNoteUpdatedAt: json.adminNoteUpdatedAt ? json.adminNoteUpdatedAt.toISOString() : null,
  };
}

export function deserializeLogFromCache(cached: CachedLog): Log {
  return Log.rehydrate({
    id: cached.id,
    source: cached.source,
    level: cached.level,
    category: cached.category,
    message: cached.message,
    context: cached.context,
    userId: cached.userId,
    requestId: cached.requestId,
    method: cached.method,
    path: cached.path,
    statusCode: cached.statusCode,
    ip: cached.ip,
    userAgent: cached.userAgent,
    fingerprint: cached.fingerprint,
    tags: cached.tags,
    occurredAt: new Date(cached.occurredAt),
    resolvedAt: cached.resolvedAt ? new Date(cached.resolvedAt) : null,
    resolvedBy: cached.resolvedBy,
    adminNote: cached.adminNote,
    adminNoteUpdatedAt: cached.adminNoteUpdatedAt ? new Date(cached.adminNoteUpdatedAt) : null,
    adminNoteUpdatedBy: cached.adminNoteUpdatedBy,
  });
}
