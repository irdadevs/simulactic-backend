import Express from "express";
import request from "supertest";
import { PerformanceMetricsMiddleware } from "../../presentation/middlewares/PerformanceMetrics.middleware";
import MetricRepo from "../../infra/repos/Metric.repository";
import { MetricCacheService } from "../../app/app-services/metrics/MetricCache.service";
import { TrackMetric } from "../../app/use-cases/commands/metrics/TrackMetric.command";
import {
  createRealInfraContext,
  RealInfraContext,
  RUN_REAL_INFRA_TESTS,
} from "../helpers/realInfra";

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 1500,
  intervalMs = 50,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for async metric persistence");
}

const describeReal = RUN_REAL_INFRA_TESTS ? describe : describe.skip;
const describeMocked = RUN_REAL_INFRA_TESTS ? describe.skip : describe;

describeReal("Integration (real infra) - PerformanceMetricsMiddleware", () => {
  let infra: RealInfraContext;

  beforeAll(async () => {
    infra = await createRealInfraContext("performance-metrics-integration");
  });

  beforeEach(async () => {
    await infra.resetDatabase();
    await infra.resetCache();
  });

  afterAll(async () => {
    await infra.close();
  });

  test("tracks and persists request duration metric", async () => {
    const trackMetric = new TrackMetric(
      new MetricRepo(infra.db),
      new MetricCacheService(infra.cache),
    );
    const middleware = new PerformanceMetricsMiddleware(trackMetric);
    const app = Express();
    app.use(middleware.captureHttpDuration());
    app.get("/ok", (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get("/ok").expect(200);

    await waitFor(async () => {
      const rows = await infra.db.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM metrics.performance_metrics
          WHERE metric_name = 'http.request.duration'
            AND metric_type = 'http'
            AND source = 'express'
        `,
      );
      return Number(rows.rows[0]?.total ?? 0) > 0;
    });
  });
});

describeMocked("Integration (mocked) - PerformanceMetricsMiddleware", () => {
  test("tracks request duration metric", async () => {
    const trackMetric = { execute: jest.fn(async () => ({ id: "1" })) } as any;
    const middleware = new PerformanceMetricsMiddleware(trackMetric);
    const app = Express();
    app.use(middleware.captureHttpDuration());
    app.get("/ok", (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get("/ok").expect(200);

    expect(trackMetric.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metricName: "http.request.duration",
        metricType: "http",
        source: "express",
        success: true,
      }),
    );
  });

  test("marks metric success=false for 5xx responses", async () => {
    const trackMetric = { execute: jest.fn(async () => ({ id: "2" })) } as any;
    const middleware = new PerformanceMetricsMiddleware(trackMetric);
    const app = Express();
    app.use(middleware.captureHttpDuration());
    app.get("/boom", (_req, res) => res.status(503).json({ ok: false }));

    await request(app).get("/boom").expect(503);

    expect(trackMetric.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        metricName: "http.request.duration",
        success: false,
        tags: expect.objectContaining({
          statusCode: 503,
        }),
      }),
    );
  });

  test("stores null userAgent when request header is non-string", async () => {
    const trackMetric = { execute: jest.fn(async () => ({ id: "3" })) } as any;
    const middleware = new PerformanceMetricsMiddleware(trackMetric);
    const app = Express();
    app.use(middleware.captureHttpDuration());
    app.get("/ua", (req, res) => {
      req.headers["user-agent"] = ["not", "a", "string"] as unknown as string;
      res.status(200).json({ ok: true });
    });

    await request(app).get("/ua").expect(200);

    expect(trackMetric.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          userAgent: null,
        }),
      }),
    );
  });
});
