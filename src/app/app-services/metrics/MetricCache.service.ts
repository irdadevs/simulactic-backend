import { ICache } from "../../interfaces/Cache.port";
import {
  DashboardQuery,
  ListMetricsQuery,
  MetricsDashboard,
  TrafficAnalytics,
  TrafficAnalyticsQuery,
} from "../../interfaces/Metric.port";
import { Metric } from "../../../domain/aggregates/Metric";
import {
  CachedDashboard,
  CachedListMetricsResult,
  CachedMetric,
  CachedTrafficAnalytics,
  METRIC_CACHE_POLICY,
  MetricCacheKeys,
  deserializeDashboardFromCache,
  deserializeMetricFromCache,
  serializeDashboardForCache,
  serializeMetricForCache,
} from "../../../utils/cache/MetricCache";

export class MetricCacheService {
  constructor(private readonly cache: ICache) {}

  async getById(id: string): Promise<Metric | null> {
    try {
      const cached = await this.cache.get<CachedMetric>(MetricCacheKeys.byId(id));
      return cached ? deserializeMetricFromCache(cached) : null;
    } catch {
      return null;
    }
  }

  async setMetric(metric: Metric): Promise<void> {
    try {
      await this.cache.set(
        MetricCacheKeys.byId(metric.id),
        serializeMetricForCache(metric),
        METRIC_CACHE_POLICY.metricTtl,
      );
    } catch {
      return;
    }
  }

  async getList(query: ListMetricsQuery): Promise<{ rows: Metric[]; total: number } | null> {
    try {
      const cached = await this.cache.get<CachedListMetricsResult>(MetricCacheKeys.list(query));
      if (!cached) return null;
      return { rows: cached.rows.map(deserializeMetricFromCache), total: cached.total };
    } catch {
      return null;
    }
  }

  async setList(query: ListMetricsQuery, result: { rows: Metric[]; total: number }): Promise<void> {
    try {
      await this.cache.set(
        MetricCacheKeys.list(query),
        { rows: result.rows.map(serializeMetricForCache), total: result.total },
        METRIC_CACHE_POLICY.metricsListTtl,
      );
    } catch {
      return;
    }
  }

  async getDashboard(query: DashboardQuery): Promise<MetricsDashboard | null> {
    try {
      const cached = await this.cache.get<CachedDashboard>(MetricCacheKeys.dashboard(query));
      return cached ? deserializeDashboardFromCache(cached) : null;
    } catch {
      return null;
    }
  }

  async setDashboard(query: DashboardQuery, dashboard: MetricsDashboard): Promise<void> {
    try {
      await this.cache.set(
        MetricCacheKeys.dashboard(query),
        serializeDashboardForCache(dashboard),
        METRIC_CACHE_POLICY.metricsDashboardTtl,
      );
    } catch {
      return;
    }
  }

  async getTrafficAnalytics(query: TrafficAnalyticsQuery): Promise<TrafficAnalytics | null> {
    try {
      const cached = await this.cache.get<CachedTrafficAnalytics>(MetricCacheKeys.traffic(query));
      return cached ?? null;
    } catch {
      return null;
    }
  }

  async setTrafficAnalytics(query: TrafficAnalyticsQuery, traffic: TrafficAnalytics): Promise<void> {
    try {
      await this.cache.set(
        MetricCacheKeys.traffic(query),
        traffic,
        METRIC_CACHE_POLICY.metricsTrafficTtl,
      );
    } catch {
      return;
    }
  }

  async invalidateForMutation(id: string): Promise<void> {
    try {
      await this.cache.del(MetricCacheKeys.byId(id));
      await this.cache.delByPrefix(MetricCacheKeys.listPrefix());
      await this.cache.delByPrefix(MetricCacheKeys.dashboardPrefix());
      await this.cache.delByPrefix(MetricCacheKeys.trafficPrefix());
    } catch {
      return;
    }
  }
}
