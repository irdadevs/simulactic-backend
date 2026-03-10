import {
  DashboardQuery,
  ListMetricsQuery,
  MetricsDashboard,
  TrafficAnalytics,
  TrafficAnalyticsQuery,
} from "../../app/interfaces/Metric.port";
import { Metric, MetricType } from "../../domain/aggregates/Metric";
import { TTL_MAP } from "../TTL.map";

export type CachedMetric = {
  id: string;
  metricName: string;
  metricType: MetricType;
  source: string;
  durationMs: number;
  success: boolean;
  userId: string | null;
  requestId: string | null;
  tags: Record<string, unknown>;
  context: Record<string, unknown>;
  occurredAt: string;
};

export type CachedListMetricsResult = {
  rows: CachedMetric[];
  total: number;
};

export type CachedDashboard = {
  from: string;
  to: string;
  summary: MetricsDashboard["summary"];
  byType: MetricsDashboard["byType"];
  topBottlenecks: MetricsDashboard["topBottlenecks"];
  recentFailures: Array<{
    id: string;
    metricName: string;
    metricType: MetricType;
    source: string;
    durationMs: number;
    occurredAt: string;
    context: Record<string, unknown>;
  }>;
};

export type CachedTrafficAnalytics = TrafficAnalytics;

export const METRIC_CACHE_POLICY = {
  metricTtl: TTL_MAP.tenMinutes,
  metricsListTtl: TTL_MAP.oneMinute,
  metricsDashboardTtl: TTL_MAP.oneMinute,
  metricsTrafficTtl: TTL_MAP.oneMinute,
} as const;

const METRICS_PREFIX = "metrics";
const METRICS_LIST_PREFIX = `${METRICS_PREFIX}:list`;
const METRICS_DASHBOARD_PREFIX = `${METRICS_PREFIX}:dashboard`;
const METRICS_TRAFFIC_PREFIX = `${METRICS_PREFIX}:traffic`;

export const MetricCacheKeys = {
  byId: (id: string): string => `${METRICS_PREFIX}:by-id:${id}`,
  listPrefix: (): string => METRICS_LIST_PREFIX,
  list: (query: ListMetricsQuery): string => `${METRICS_LIST_PREFIX}:${JSON.stringify(query)}`,
  dashboardPrefix: (): string => METRICS_DASHBOARD_PREFIX,
  dashboard: (query: DashboardQuery): string =>
    `${METRICS_DASHBOARD_PREFIX}:${JSON.stringify({ hours: query.hours ?? 24, topLimit: query.topLimit ?? 10 })}`,
  trafficPrefix: (): string => METRICS_TRAFFIC_PREFIX,
  traffic: (query: TrafficAnalyticsQuery): string =>
    `${METRICS_TRAFFIC_PREFIX}:${JSON.stringify({
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      limitRecent: query.limitRecent ?? 20,
      limitRoutes: query.limitRoutes ?? 20,
      limitReferrers: query.limitReferrers ?? 20,
    })}`,
};

export function serializeMetricForCache(metric: Metric): CachedMetric {
  const json = metric.toJSON();
  return {
    ...json,
    occurredAt: json.occurredAt.toISOString(),
  };
}

export function deserializeMetricFromCache(cached: CachedMetric): Metric {
  return Metric.rehydrate({
    id: cached.id,
    metricName: cached.metricName,
    metricType: cached.metricType,
    source: cached.source,
    durationMs: cached.durationMs,
    success: cached.success,
    userId: cached.userId,
    requestId: cached.requestId,
    tags: cached.tags,
    context: cached.context,
    occurredAt: new Date(cached.occurredAt),
  });
}

export function serializeDashboardForCache(dashboard: MetricsDashboard): CachedDashboard {
  return {
    ...dashboard,
    from: dashboard.from.toISOString(),
    to: dashboard.to.toISOString(),
    recentFailures: dashboard.recentFailures.map((x) => ({
      ...x,
      occurredAt: x.occurredAt.toISOString(),
    })),
  };
}

export function deserializeDashboardFromCache(cached: CachedDashboard): MetricsDashboard {
  return {
    ...cached,
    from: new Date(cached.from),
    to: new Date(cached.to),
    recentFailures: cached.recentFailures.map((x) => ({
      ...x,
      occurredAt: new Date(x.occurredAt),
    })),
  };
}
