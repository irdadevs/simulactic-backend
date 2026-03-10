import { Metric, MetricType } from "../../domain/aggregates/Metric";

export type TrackMetricInput = {
  metricName: string;
  metricType: MetricType;
  source: string;
  durationMs: number;
  success?: boolean;
  userId?: string | null;
  requestId?: string | null;
  tags?: Record<string, unknown>;
  context?: Record<string, unknown>;
  occurredAt?: Date;
};

export type ListMetricsQuery = {
  metricType?: MetricType;
  metricName?: string;
  source?: string;
  requestId?: string;
  userId?: string;
  success?: boolean;
  minDurationMs?: number;
  maxDurationMs?: number;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  orderBy?: "occurredAt" | "durationMs" | "metricName";
  orderDir?: "asc" | "desc";
};

export type DashboardQuery = {
  hours?: number;
  topLimit?: number;
};

export type TrafficAnalyticsQuery = {
  from: Date;
  to: Date;
  limitRecent?: number;
  limitRoutes?: number;
  limitReferrers?: number;
};

export type TrafficPageViewRecord = {
  id: string;
  durationMs: number;
  occurredAt: Date;
  tags: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type TrafficAnalytics = {
  overview: {
    pageViews: number;
    uniqueSessions: number;
    trackedRoutes: number;
    externalReferrals: number;
  };
  viewsByDay: Array<{ date: string; views: number }>;
  routes: Array<{ path: string; views: number; uniqueSessions: number; avgDurationMs: number }>;
  referrers: Array<{ referrer: string; views: number }>;
  recentViews: Array<{
    id: string;
    occurredAt: string;
    path: string | null;
    fullPath: string | null;
    referrerHost: string | null;
    sessionId: string | null;
    viewport: { width: number; height: number } | null;
    durationMs: number;
  }>;
};

export type DashboardSummary = {
  total: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  maxDurationMs: number;
  errorRate: number;
};

export type DashboardByTypeRow = {
  metricType: MetricType;
  total: number;
  avgDurationMs: number;
  p95DurationMs: number;
  errorRate: number;
};

export type DashboardBottleneckRow = {
  metricName: string;
  metricType: MetricType;
  source: string;
  total: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  errorRate: number;
};

export type MetricsDashboard = {
  from: Date;
  to: Date;
  summary: DashboardSummary;
  byType: DashboardByTypeRow[];
  topBottlenecks: DashboardBottleneckRow[];
  recentFailures: Array<{
    id: string;
    metricName: string;
    metricType: MetricType;
    source: string;
    durationMs: number;
    occurredAt: Date;
    context: Record<string, unknown>;
  }>;
};

export interface IMetric {
  save(metric: Metric): Promise<Metric>;
  findById(id: string): Promise<Metric | null>;
  list(query: ListMetricsQuery): Promise<{ rows: Metric[]; total: number }>;
  dashboard(query: DashboardQuery): Promise<MetricsDashboard>;
  listTrafficPageViews(query: TrafficAnalyticsQuery): Promise<TrafficPageViewRecord[]>;
}
