import Express from "express";
import request from "supertest";
import { RequestAuditMiddleware } from "../../presentation/middlewares/RequestAudit.middleware";
import LogRepo from "../../infra/repos/Log.repository";
import { LogCacheService } from "../../app/app-services/logs/LogCache.service";
import { CreateLog } from "../../app/use-cases/commands/logs/CreateLog.command";
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
  throw new Error("Timed out waiting for async log persistence");
}

const describeReal = RUN_REAL_INFRA_TESTS ? describe : describe.skip;
const describeMocked = RUN_REAL_INFRA_TESTS ? describe.skip : describe;

describeReal("Integration (real infra) - RequestAuditMiddleware", () => {
  let infra: RealInfraContext;

  beforeAll(async () => {
    infra = await createRealInfraContext("request-audit-integration");
  });

  beforeEach(async () => {
    await infra.resetDatabase();
    await infra.resetCache();
  });

  afterAll(async () => {
    await infra.close();
  });

  test("adds request id and persists security responses", async () => {
    const createLog = new CreateLog(new LogRepo(infra.db), new LogCacheService(infra.cache));
    const middleware = new RequestAuditMiddleware(createLog);

    const app = Express();
    app.use(middleware.bindRequestId());
    app.use(middleware.logResponse());
    app.get("/forbidden", (_req, res) => {
      res.status(403).json({ ok: false });
    });

    const response = await request(app).get("/forbidden").expect(403);
    expect(response.headers["x-request-id"]).toBeDefined();

    await waitFor(async () => {
      const rows = await infra.db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM logs.error_log WHERE http_path = '/forbidden' AND status_code = 403`,
      );
      return Number(rows.rows[0]?.total ?? 0) > 0;
    });
  });

  test("persists successful mutating requests as audit entries", async () => {
    const createLog = new CreateLog(new LogRepo(infra.db), new LogCacheService(infra.cache));
    const middleware = new RequestAuditMiddleware(createLog);

    const app = Express();
    app.use(Express.json());
    app.use(middleware.bindRequestId());
    app.use(middleware.logResponse());
    app.patch("/resource", (_req, res) => res.status(204).send());

    await request(app).patch("/resource").send({ x: 1 }).expect(204);

    await waitFor(async () => {
      const rows = await infra.db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM logs.error_log WHERE http_path = '/resource' AND http_method = 'PATCH' AND status_code = 204 AND resolved_at IS NOT NULL`,
      );
      return Number(rows.rows[0]?.total ?? 0) > 0;
    });
  });
});

describeMocked("Integration (mocked) - RequestAuditMiddleware", () => {
  test("adds request id and logs security responses", async () => {
    const createLog = { execute: jest.fn(async () => ({ id: "1" })) } as any;
    const middleware = new RequestAuditMiddleware(createLog);
    const app = Express();
    app.use(middleware.bindRequestId());
    app.use(middleware.logResponse());
    app.get("/forbidden", (_req, res) => {
      res.status(403).json({ ok: false });
    });

    const response = await request(app).get("/forbidden").expect(403);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(createLog.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "http",
        category: "security",
        level: "warn",
        statusCode: 403,
        path: "/forbidden",
      }),
    );
  });

  test("logs successful mutating requests as audit entries", async () => {
    const createLog = { execute: jest.fn(async () => ({ id: "2" })) } as any;
    const middleware = new RequestAuditMiddleware(createLog);
    const app = Express();
    app.use(Express.json());
    app.use(middleware.bindRequestId());
    app.use(middleware.logResponse());
    app.patch("/resource", (_req, res) => res.status(204).send());

    await request(app).patch("/resource").send({ x: 1 }).expect(204);
    expect(createLog.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "audit",
        level: "info",
        statusCode: 204,
      }),
    );
  });
});
