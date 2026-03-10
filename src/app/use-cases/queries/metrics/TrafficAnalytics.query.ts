import { MetricCacheService } from "../../../app-services/metrics/MetricCache.service";
import { IMetric, TrafficAnalytics, TrafficAnalyticsQuery } from "../../../interfaces/Metric.port";

export class TrafficAnalyticsQueryService {
  constructor(
    private readonly repo: IMetric,
    private readonly cache: MetricCacheService,
  ) {}

  async execute(query: TrafficAnalyticsQuery): Promise<TrafficAnalytics> {
    const cached = await this.cache.getTrafficAnalytics(query);
    if (cached) return cached;

    const analytics = await this.repo.trafficAnalytics(query);
    await this.cache.setTrafficAnalytics(query, analytics);
    return analytics;
  }
}
