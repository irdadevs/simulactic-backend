import {
  IMetric,
  TrafficAnalytics,
  TrafficAnalyticsQuery,
  TrafficPageViewRecord,
} from "../../../interfaces/Metric.port";
import { MetricCacheService } from "../../../app-services/metrics/MetricCache.service";

type RouteAccumulator = {
  path: string;
  views: number;
  totalDurationMs: number;
  sessions: Set<string>;
};

type ReferrerAccumulator = {
  referrer: string;
  views: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asBoolean = (value: unknown): boolean => value === true;

const asViewport = (value: unknown): { width: number; height: number } | null => {
  const record = asRecord(value);
  const width = record.width;
  const height = record.height;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
};

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Route grouping priority:
// 1. context.pathname
// 2. context.fullPath
// 3. tags.pathname
// 4. unknown
const normalizedRoutePath = (row: TrafficPageViewRecord): string => {
  const context = asRecord(row.context);
  const tags = asRecord(row.tags);
  return (
    asStringOrNull(context.pathname) ??
    asStringOrNull(context.fullPath) ??
    asStringOrNull(tags.pathname) ??
    "unknown"
  );
};

export class TrafficAnalyticsQueryService {
  constructor(
    private readonly repo: IMetric,
    private readonly cache: MetricCacheService,
  ) {}

  async execute(query: TrafficAnalyticsQuery): Promise<TrafficAnalytics> {
    const cached = await this.cache.getTrafficAnalytics(query);
    if (cached) return cached;

    const rows = await this.repo.listTrafficPageViews(query);
    const byDay = new Map<string, number>();
    const routes = new Map<string, RouteAccumulator>();
    const referrers = new Map<string, ReferrerAccumulator>();
    const uniqueSessions = new Set<string>();
    let externalReferrals = 0;

    const fromDay = startOfUtcDay(query.from);
    const toDay = startOfUtcDay(query.to);

    for (let cursor = fromDay; cursor <= toDay; cursor = addUtcDays(cursor, 1)) {
      byDay.set(dayKey(cursor), 0);
    }

    for (const row of rows) {
      const context = asRecord(row.context);
      const tags = asRecord(row.tags);
      const date = dayKey(row.occurredAt);
      byDay.set(date, (byDay.get(date) ?? 0) + 1);

      const sessionId = asStringOrNull(context.sessionId);
      if (sessionId) uniqueSessions.add(sessionId);

      if (asBoolean(tags.externalReferrer)) {
        externalReferrals += 1;
      }

      const path = normalizedRoutePath(row);
      const route = routes.get(path) ?? {
        path,
        views: 0,
        totalDurationMs: 0,
        sessions: new Set<string>(),
      };
      route.views += 1;
      route.totalDurationMs += row.durationMs;
      if (sessionId) route.sessions.add(sessionId);
      routes.set(path, route);

      const referrerHost = asStringOrNull(context.referrerHost) ?? asStringOrNull(tags.referrerHost);
      if (referrerHost) {
        const referrer = referrers.get(referrerHost) ?? { referrer: referrerHost, views: 0 };
        referrer.views += 1;
        referrers.set(referrerHost, referrer);
      }
    }

    const result: TrafficAnalytics = {
      overview: {
        pageViews: rows.length,
        uniqueSessions: uniqueSessions.size,
        trackedRoutes: routes.size,
        externalReferrals,
      },
      viewsByDay: Array.from(byDay.entries()).map(([date, views]) => ({ date, views })),
      routes: Array.from(routes.values())
        .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
        .slice(0, query.limitRoutes ?? 20)
        .map((route) => ({
          path: route.path,
          views: route.views,
          uniqueSessions: route.sessions.size,
          avgDurationMs: route.views > 0 ? route.totalDurationMs / route.views : 0,
        })),
      referrers: Array.from(referrers.values())
        .sort((a, b) => b.views - a.views || a.referrer.localeCompare(b.referrer))
        .slice(0, query.limitReferrers ?? 20),
      recentViews: rows
        .slice()
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, query.limitRecent ?? 20)
        .map((row) => {
          const context = asRecord(row.context);
          return {
            id: row.id,
            occurredAt: row.occurredAt.toISOString(),
            path: asStringOrNull(context.pathname),
            fullPath: asStringOrNull(context.fullPath),
            referrerHost:
              asStringOrNull(context.referrerHost) ?? asStringOrNull(asRecord(row.tags).referrerHost),
            sessionId: asStringOrNull(context.sessionId),
            viewport: asViewport(context.viewport),
            durationMs: row.durationMs,
          };
        }),
    };

    await this.cache.setTrafficAnalytics(query, result);
    return result;
  }
}
