import { MetricCacheService } from "../../app/app-services/metrics/MetricCache.service";
import { IMetric, TrafficAnalytics } from "../../app/interfaces/Metric.port";
import { TrackMetric } from "../../app/use-cases/commands/metrics/TrackMetric.command";
import { TrafficAnalyticsQueryService } from "../../app/use-cases/queries/metrics/TrafficAnalytics.query";
import { Metric } from "../../domain/aggregates/Metric";

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

describe("Metric aggregate", () => {
  it("creates a metric", () => {
    const metric = Metric.create({
      metricName: "use_case.galaxy.create",
      metricType: "use_case",
      source: "CreateGalaxy",
      durationMs: 120,
      success: true,
      userId: "11111111-1111-4111-8111-111111111111",
      requestId: "req-xyz",
      tags: { op: "create" },
      context: { systems: 20 },
    });

    expect(metric.metricName).toBe("use_case.galaxy.create");
    expect(metric.metricType).toBe("use_case");
    expect(metric.source).toBe("CreateGalaxy");
    expect(metric.durationMs).toBe(120);
    expect(metric.success).toBe(true);
    expect(metric.userId).toBe("11111111-1111-4111-8111-111111111111");
    expect(metric.tags).toEqual({ op: "create" });
  });

  it("throws on negative duration", () => {
    assertDomainErrorCode(
      () =>
        Metric.create({
          metricName: "db.query.duration",
          metricType: "db",
          source: "PgPoolQueryable",
          durationMs: -1,
        }),
      "PRESENTATION.INVALID_FIELD",
    );
  });

  it("throws on invalid metric name", () => {
    assertDomainErrorCode(
      () =>
        Metric.create({
          metricName: " ",
          metricType: "db",
          source: "PgPoolQueryable",
          durationMs: 1,
        }),
      "PRESENTATION.INVALID_FIELD",
    );
  });
});

describe("TrackMetric command", () => {
  it("sanitizes sensitive fields and invalidates cache", async () => {
    const saved = Metric.create({
      id: "1",
      metricName: "http.request.duration",
      metricType: "http",
      source: "express",
      durationMs: 25,
      success: true,
      context: { ok: true },
    });

    const repo: Pick<IMetric, "save"> = {
      save: jest.fn(async () => saved),
    };
    const cache = {
      invalidateForMutation: jest.fn(async (): Promise<void> => undefined),
    } as unknown as MetricCacheService;

    const command = new TrackMetric(repo as IMetric, cache);
    const result = await command.execute({
      metricName: "http.request.duration",
      metricType: "http",
      source: "express",
      durationMs: 25,
      success: true,
      tags: { authorization: "Bearer x" },
      context: { password: "123", nested: { token: "abc" } },
    });

    expect(result.id).toBe(saved.id);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const payload = (repo.save as jest.Mock).mock.calls[0][0] as Metric;
    expect(payload.tags).toEqual({ authorization: "[redacted]" });
    expect(payload.context).toEqual({
      password: "[redacted]",
      nested: { token: "[redacted]" },
    });
    expect(cache.invalidateForMutation).toHaveBeenCalledWith(saved.id);
  });
});

describe("TrafficAnalyticsQueryService", () => {
  it("loads analytics from repo and caches the result", async () => {
    const analytics: TrafficAnalytics = {
      overview: {
        pageViews: 3,
        uniqueSessions: 2,
        trackedRoutes: 3,
        externalReferrals: 1,
      },
      viewsByDay: [
        { date: "2026-03-08", views: 2 },
        { date: "2026-03-09", views: 0 },
        { date: "2026-03-10", views: 1 },
      ],
      routes: [
        { path: "/admin/users", views: 1, uniqueSessions: 1, avgDurationMs: 40 },
        { path: "/admin/users?page=2", views: 1, uniqueSessions: 1, avgDurationMs: 20 },
        { path: "unknown", views: 1, uniqueSessions: 1, avgDurationMs: 60 },
      ],
      referrers: [{ referrer: "google.com", views: 1 }],
      recentViews: [],
    };

    const repo: Pick<IMetric, "trafficAnalytics"> = {
      trafficAnalytics: jest.fn(async () => analytics),
    };
    const cache = {
      getTrafficAnalytics: jest.fn(async (): Promise<TrafficAnalytics | null> => null),
      setTrafficAnalytics: jest.fn(async (): Promise<void> => undefined),
    } as unknown as MetricCacheService;

    const query = new TrafficAnalyticsQueryService(repo as IMetric, cache);
    const result = await query.execute({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-10T23:59:59.999Z"),
      limitRoutes: 10,
      limitRecent: 10,
      limitReferrers: 10,
    });

    expect(result).toEqual(analytics);
    expect(repo.trafficAnalytics).toHaveBeenCalledWith({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-10T23:59:59.999Z"),
      limitRoutes: 10,
      limitRecent: 10,
      limitReferrers: 10,
    });
    expect(cache.setTrafficAnalytics).toHaveBeenCalledWith(
      {
        from: new Date("2026-03-08T00:00:00.000Z"),
        to: new Date("2026-03-10T23:59:59.999Z"),
        limitRoutes: 10,
        limitRecent: 10,
        limitReferrers: 10,
      },
      analytics,
    );
  });

  it("returns cached traffic analytics when available", async () => {
    const cached: TrafficAnalytics = {
      overview: {
        pageViews: 1,
        uniqueSessions: 1,
        trackedRoutes: 1,
        externalReferrals: 0,
      },
      viewsByDay: [{ date: "2026-03-08", views: 1 }],
      routes: [{ path: "/cached", views: 1, uniqueSessions: 1, avgDurationMs: 12 }],
      referrers: [],
      recentViews: [],
    };

    const repo: Pick<IMetric, "trafficAnalytics"> = {
      trafficAnalytics: jest.fn(async () => cached),
    };
    const cache = {
      getTrafficAnalytics: jest.fn(async (): Promise<TrafficAnalytics | null> => cached),
      setTrafficAnalytics: jest.fn(async (): Promise<void> => undefined),
    } as unknown as MetricCacheService;

    const query = new TrafficAnalyticsQueryService(repo as IMetric, cache);
    const result = await query.execute({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-08T23:59:59.999Z"),
    });

    expect(result).toEqual(cached);
    expect(repo.trafficAnalytics).not.toHaveBeenCalled();
  });
});
