import { MetricCacheService } from "../../app/app-services/metrics/MetricCache.service";
import { IMetric, TrafficAnalytics, TrafficPageViewRecord } from "../../app/interfaces/Metric.port";
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
  it("aggregates by day, route and unique session with zero-filled days", async () => {
    const rows = [
      {
        id: "1",
        durationMs: 40,
        occurredAt: new Date("2026-03-08T10:00:00.000Z"),
        context: {
          pathname: "/admin/users",
          fullPath: "/admin/users?page=1",
          sessionId: "sess-1",
          referrerHost: "google.com",
          viewport: { width: 1440, height: 900 },
        },
        tags: { externalReferrer: true },
      },
      {
        id: "2",
        durationMs: 20,
        occurredAt: new Date("2026-03-08T12:00:00.000Z"),
        context: {
          fullPath: "/admin/users?page=2",
          sessionId: "sess-1",
        },
        tags: { pathname: "/fallback-tag-route", externalReferrer: false },
      },
      {
        id: "3",
        durationMs: 60,
        occurredAt: new Date("2026-03-10T09:00:00.000Z"),
        context: {
          sessionId: "sess-2",
        },
        tags: {},
      },
    ];

    const repo: Pick<IMetric, "listTrafficPageViews"> = {
      listTrafficPageViews: jest.fn(async (): Promise<TrafficPageViewRecord[]> => rows as any),
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

    expect(result.overview).toEqual({
      pageViews: 3,
      uniqueSessions: 2,
      trackedRoutes: 3,
      externalReferrals: 1,
    });
    expect(result.viewsByDay).toEqual([
      { date: "2026-03-08", views: 2 },
      { date: "2026-03-09", views: 0 },
      { date: "2026-03-10", views: 1 },
    ]);
    expect(result.routes).toEqual([
      {
        path: "/admin/users",
        views: 1,
        uniqueSessions: 1,
        avgDurationMs: 40,
      },
      {
        path: "/admin/users?page=2",
        views: 1,
        uniqueSessions: 1,
        avgDurationMs: 20,
      },
      {
        path: "unknown",
        views: 1,
        uniqueSessions: 1,
        avgDurationMs: 60,
      },
    ]);
    expect(result.referrers).toEqual([{ referrer: "google.com", views: 1 }]);
    expect(result.recentViews[0]).toEqual(
      expect.objectContaining({
        id: "3",
        path: null,
        fullPath: null,
        sessionId: "sess-2",
      }),
    );
  });

  it("uses route priority pathname > fullPath > tags.pathname", async () => {
    const rows = [
      {
        id: "1",
        durationMs: 10,
        occurredAt: new Date("2026-03-08T10:00:00.000Z"),
        context: { pathname: "/first", fullPath: "/second" },
        tags: { pathname: "/third" },
      },
      {
        id: "2",
        durationMs: 10,
        occurredAt: new Date("2026-03-08T11:00:00.000Z"),
        context: { fullPath: "/second" },
        tags: { pathname: "/third" },
      },
      {
        id: "3",
        durationMs: 10,
        occurredAt: new Date("2026-03-08T12:00:00.000Z"),
        context: {},
        tags: { pathname: "/third" },
      },
    ];

    const repo: Pick<IMetric, "listTrafficPageViews"> = {
      listTrafficPageViews: jest.fn(async (): Promise<TrafficPageViewRecord[]> => rows as any),
    };
    const cache = {
      getTrafficAnalytics: jest.fn(async (): Promise<TrafficAnalytics | null> => null),
      setTrafficAnalytics: jest.fn(async (): Promise<void> => undefined),
    } as unknown as MetricCacheService;

    const query = new TrafficAnalyticsQueryService(repo as IMetric, cache);
    const result = await query.execute({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-08T23:59:59.999Z"),
    });

    expect(result.routes.map((row) => row.path)).toEqual(["/first", "/second", "/third"]);
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

    const repo: Pick<IMetric, "listTrafficPageViews"> = {
      listTrafficPageViews: jest.fn(async (): Promise<TrafficPageViewRecord[]> => []),
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
    expect(repo.listTrafficPageViews).not.toHaveBeenCalled();
  });
});
