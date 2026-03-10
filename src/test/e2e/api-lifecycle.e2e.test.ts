import request from "supertest";
import { Express as ExpressApp } from "express";
import { Planet } from "../../domain/aggregates/Planet";
import PlanetRepo from "../../infra/repos/Planet.repository";
import {
  createRealInfraContext,
  RealInfraContext,
  RUN_REAL_INFRA_TESTS,
} from "../helpers/realInfra";
import { buildRealApiApp } from "../helpers/realApiApp";

type LoginResult = {
  cookies: string[];
};

const describeReal = RUN_REAL_INFRA_TESTS ? describe : describe.skip;

describeReal("API E2E (real infra) - auth, ownership and lifecycle", () => {
  let infra: RealInfraContext;
  let app: ExpressApp;

  let userA: { id: string; email: string; username: string };
  let userB: { id: string; email: string; username: string };
  let admin: { id: string; email: string; username: string };

  let galaxyAId = "";
  let galaxyBId = "";
  let systemBId = "";
  let starBId = "";
  let planetBId = "";
  let moonBId = "";
  let asteroidBId = "";

  const password = "Passw0rd!123";

  async function login(email: string): Promise<LoginResult> {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ email, rawPassword: password })
      .expect(200);

    const raw = res.headers["set-cookie"];
    const cookies = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(
      (cookie) => cookie.split(";")[0],
    );
    return { cookies };
  }

  beforeAll(async () => {
    infra = await createRealInfraContext("api-lifecycle-e2e");
    await infra.resetDatabase();
    await infra.resetCache();

    const built = buildRealApiApp(infra);
    app = built.app;

    userA = await built.seedUser({
      email: "e2e.user.a@test.local",
      username: "e2e_user_a",
      password,
      role: "User",
    });
    userB = await built.seedUser({
      email: "e2e.user.b@test.local",
      username: "e2e_user_b",
      password,
      role: "User",
    });
    admin = await built.seedUser({
      email: "e2e.admin@test.local",
      username: "e2e_admin",
      password,
      role: "Admin",
    });

    const userALogin = await login(userA.email);
    const userBLogin = await login(userB.email);

    const createdA = await request(app)
      .post("/api/v1/galaxies")
      .set("Cookie", userALogin.cookies)
      .send({ name: "Alpha-01", shape: "spherical", systemCount: 3 })
      .expect(201);
    galaxyAId = createdA.body.id;

    const createdB = await request(app)
      .post("/api/v1/galaxies")
      .set("Cookie", userBLogin.cookies)
      .send({ name: "Beta-001", shape: "irregular", systemCount: 3 })
      .expect(201);
    galaxyBId = createdB.body.id;

    const populatedB = await request(app)
      .get(`/api/v1/galaxies/${galaxyBId}/populate`)
      .set("Cookie", userBLogin.cookies)
      .expect(200);

    const firstSystem = populatedB.body.systems[0];
    systemBId = firstSystem.system.id;
    starBId = firstSystem.stars[0].id;

    let ensuredPlanetId: string | undefined = firstSystem.planets[0]?.planet?.id;
    let ensuredMoonId: string | undefined = firstSystem.planets[0]?.moons?.[0]?.id;
    let ensuredAsteroidId: string | undefined = firstSystem.asteroids[0]?.id;

    if (!ensuredPlanetId) {
      const insertedPlanet = await infra.db.query<{ id: string }>(
        `
          INSERT INTO procedurals.planets
            (system_id, name, type, size, orbital, biome, relative_mass, absolute_mass, relative_radius, absolute_radius, gravity, temperature)
          VALUES
            ($1, 'PlanetSeedB', 'solid', 'medium', 2, 'temperate', 1, 1, 1, 1, 9.8, 288)
          RETURNING id
        `,
        [systemBId],
      );
      ensuredPlanetId = insertedPlanet.rows[0].id;
    }

    if (!ensuredMoonId) {
      const insertedMoon = await infra.db.query<{ id: string }>(
        `
          INSERT INTO procedurals.moons
            (planet_id, name, size, orbital, relative_mass, absolute_mass, relative_radius, absolute_radius, gravity, temperature)
          VALUES
            ($1, 'MoonSeedB', 'medium', 1, 1, 1, 1, 1, 1.62, 220)
          RETURNING id
        `,
        [ensuredPlanetId],
      );
      ensuredMoonId = insertedMoon.rows[0].id;
    }

    if (!ensuredAsteroidId) {
      const insertedAsteroid = await infra.db.query<{ id: string }>(
        `
          INSERT INTO procedurals.asteroids
            (system_id, name, type, size, orbital)
          VALUES
            ($1, 'AST-501', 'single', 'small', 2.5)
          RETURNING id
        `,
        [systemBId],
      );
      ensuredAsteroidId = insertedAsteroid.rows[0].id;
    }

    planetBId = ensuredPlanetId;
    moonBId = ensuredMoonId;
    asteroidBId = ensuredAsteroidId;
  });

  afterAll(async () => {
    await infra.close();
  });

  test("rejects protected endpoints when auth is missing", async () => {
    await request(app).get("/api/v1/galaxies").expect(401);
  });

  test("login sets access and refresh cookies", async () => {
    const result = await login(userA.email);
    expect(result.cookies.some((value) => value.startsWith("access_token="))).toBe(true);
    expect(result.cookies.some((value) => value.startsWith("refresh_token="))).toBe(true);
  });

  test("refresh rotates auth cookies using refresh_token cookie", async () => {
    const result = await login(userA.email);
    const refreshed = await request(app)
      .post("/api/v1/users/token/refresh")
      .set("Cookie", result.cookies)
      .expect(200);

    const rawSetCookie = refreshed.headers["set-cookie"];
    const cookies = Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [];
    expect(cookies.some((value) => value.startsWith("access_token="))).toBe(true);
    expect(cookies.some((value) => value.startsWith("refresh_token="))).toBe(true);
  });

  test("non-admin list returns only own galaxies", async () => {
    const userALogin = await login(userA.email);
    const response = await request(app)
      .get("/api/v1/galaxies")
      .set("Cookie", userALogin.cookies)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.rows[0].ownerId).toBe(userA.id);
    expect(response.body.rows[0].id).toBe(galaxyAId);
  });

  test("admin can list all galaxies", async () => {
    const adminLogin = await login(admin.email);
    const response = await request(app)
      .get("/api/v1/galaxies?limit=20&offset=0")
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(Number(response.body.total)).toBeGreaterThanOrEqual(2);
  });

  test("forbids non-owner access to another user's galaxy and nested resources", async () => {
    const userALogin = await login(userA.email);

    await request(app)
      .get(`/api/v1/galaxies/${galaxyBId}`)
      .set("Cookie", userALogin.cookies)
      .expect(403);

    await request(app)
      .patch(`/api/v1/systems/${systemBId}/name`)
      .set("Cookie", userALogin.cookies)
      .send({ name: "ForbiddenSystem" })
      .expect(403);

    await request(app)
      .patch(`/api/v1/stars/${starBId}/main`)
      .set("Cookie", userALogin.cookies)
      .send({ isMain: false })
      .expect(403);

    await request(app)
      .patch(`/api/v1/planets/${planetBId}/biome`)
      .set("Cookie", userALogin.cookies)
      .send({ biome: "desert" })
      .expect(403);

    await request(app)
      .patch(`/api/v1/moons/${moonBId}/size`)
      .set("Cookie", userALogin.cookies)
      .send({ size: "medium" })
      .expect(403);

    await request(app)
      .patch(`/api/v1/asteroids/${asteroidBId}/type`)
      .set("Cookie", userALogin.cookies)
      .send({ type: "single" })
      .expect(403);
  });

  test("admin can mutate nested resources from any owner", async () => {
    const adminLogin = await login(admin.email);
    await request(app)
      .patch(`/api/v1/stars/${starBId}/main`)
      .set("Cookie", adminLogin.cookies)
      .send({ isMain: true })
      .expect(204);
  });

  test("populate returns full nested galaxy data", async () => {
    const userBLogin = await login(userB.email);
    const response = await request(app)
      .get(`/api/v1/galaxies/${galaxyBId}/populate`)
      .set("Cookie", userBLogin.cookies)
      .expect(200);

    expect(response.body.galaxy.id).toBe(galaxyBId);
    expect(Array.isArray(response.body.systems)).toBe(true);
    expect(response.body.systems.length).toBeGreaterThan(0);
    expect(response.body.systems[0].system).toBeDefined();
    expect(Array.isArray(response.body.systems[0].stars)).toBe(true);
    expect(Array.isArray(response.body.systems[0].planets)).toBe(true);
    expect(Array.isArray(response.body.systems[0].asteroids)).toBe(true);
  });

  test('persists gas planets with biome "none"', async () => {
    const repo = new PlanetRepo(infra.db);
    const gasPlanet = Planet.create({
      systemId: systemBId,
      name: "GasSeedB",
      type: "gas",
      size: "giant",
      orbital: 7,
      biome: "desert",
    });

    const saved = await repo.create(gasPlanet);
    expect(saved.biome).toBe("none");

    const userBLogin = await login(userB.email);
    const response = await request(app)
      .get(`/api/v1/planets/${saved.id}`)
      .set("Cookie", userBLogin.cookies)
      .expect(200);

    expect(response.body.id).toBe(saved.id);
    expect(response.body.type).toBe("gas");
    expect(response.body.biome).toBe("none");
  });

  test("admin can reopen resolved non-info logs", async () => {
    const adminLogin = await login(admin.email);
    const created = await request(app)
      .post("/api/v1/logs")
      .set("Cookie", adminLogin.cookies)
      .send({
        source: "ops",
        level: "warn",
        category: "application",
        message: "Log to reopen",
      })
      .expect(201);

    const logId = String(created.body.id);

    await request(app)
      .patch(`/api/v1/logs/${logId}/resolve`)
      .set("Cookie", adminLogin.cookies)
      .expect(204);

    await request(app)
      .patch(`/api/v1/logs/${logId}/reopen`)
      .set("Cookie", adminLogin.cookies)
      .expect(204);

    const fetched = await request(app)
      .get(`/api/v1/logs/${logId}?view=dashboard`)
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(fetched.body.id).toBe(logId);
    expect(fetched.body.level).toBe("warn");
    expect(fetched.body.resolvedAt).toBeNull();
    expect(fetched.body.resolvedBy).toBeNull();
    expect(fetched.body.adminNote).toBeNull();
    expect(fetched.body.adminNoteUpdatedAt).toBeNull();
    expect(fetched.body.adminNoteUpdatedBy).toBeNull();
  });

  test("admin cannot reopen info logs", async () => {
    const adminLogin = await login(admin.email);
    const created = await request(app)
      .post("/api/v1/logs")
      .set("Cookie", adminLogin.cookies)
      .send({
        source: "audit",
        level: "info",
        category: "audit",
        message: "Info log stays closed",
      })
      .expect(201);

    await request(app)
      .patch(`/api/v1/logs/${created.body.id}/reopen`)
      .set("Cookie", adminLogin.cookies)
      .expect(422);
  });

  test("admin can set and clear a log note", async () => {
    const adminLogin = await login(admin.email);
    const created = await request(app)
      .post("/api/v1/logs")
      .set("Cookie", adminLogin.cookies)
      .send({
        source: "ops",
        level: "error",
        category: "application",
        message: "Log note lifecycle",
      })
      .expect(201);

    const logId = String(created.body.id);

    await request(app)
      .patch(`/api/v1/logs/${logId}/admin-note`)
      .set("Cookie", adminLogin.cookies)
      .send({ note: "Assigned to on-call admin" })
      .expect(204);

    const withNote = await request(app)
      .get(`/api/v1/logs/${logId}?view=dashboard`)
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(withNote.body.adminNote).toBe("Assigned to on-call admin");
    expect(withNote.body.adminNoteUpdatedAt).not.toBeNull();
    expect(withNote.body.adminNoteUpdatedBy).toBe(admin.id);

    await request(app)
      .delete(`/api/v1/logs/${logId}/admin-note`)
      .set("Cookie", adminLogin.cookies)
      .expect(204);

    const cleared = await request(app)
      .get(`/api/v1/logs/${logId}?view=dashboard`)
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(cleared.body.adminNote).toBeNull();
    expect(cleared.body.adminNoteUpdatedAt).toBeNull();
    expect(cleared.body.adminNoteUpdatedBy).toBeNull();
  });

  test("admin log dashboard view returns raw unmasked log data", async () => {
    const adminLogin = await login(admin.email);
    const created = await request(app)
      .post("/api/v1/logs")
      .set("Cookie", adminLogin.cookies)
      .send({
        source: "security",
        level: "error",
        category: "security",
        message: "Sensitive log payload",
        requestId: "dashboard-log-1",
        ip: "203.0.113.5",
        userAgent: "DashboardBrowser/1.0",
        fingerprint: "fp_sensitive_dashboard_123",
        tags: {
          authorization: "Bearer raw-tag-token",
        },
        context: {
          authorization: "Bearer raw-context-token",
          nested: { cookie: "session=raw-cookie" },
        },
      })
      .expect(201);

    const response = await request(app)
      .get(`/api/v1/logs/${created.body.id}?view=dashboard`)
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(response.body.context).toEqual({
      authorization: "Bearer raw-context-token",
      nested: { cookie: "session=raw-cookie" },
    });
    expect(response.body.tags).toEqual({
      authorization: "Bearer raw-tag-token",
    });
    expect(response.body.ip).toBe("203.0.113.5");
    expect(response.body.userAgent).toBe("DashboardBrowser/1.0");
    expect(response.body.fingerprint).toBe("fp_sensitive_dashboard_123");
    expect(response.body).not.toHaveProperty("ipMasked");
    expect(response.body).not.toHaveProperty("fingerprintMasked");
  });

  test("counts returns aggregate totals for a galaxy", async () => {
    const userBLogin = await login(userB.email);
    const response = await request(app)
      .get(`/api/v1/galaxies/${galaxyBId}/counts`)
      .set("Cookie", userBLogin.cookies)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        systems: expect.any(Number),
        stars: expect.any(Number),
        planets: expect.any(Number),
        moons: expect.any(Number),
        asteroids: expect.any(Number),
      }),
    );
    expect(response.body.systems).toBeGreaterThan(0);
    expect(response.body.stars).toBeGreaterThan(0);
  });

  test("admin traffic analytics aggregates stored page view metrics", async () => {
    await infra.db.query(
      `
        INSERT INTO metrics.performance_metrics
          (metric_name, metric_type, source, duration_ms, success, request_id, tags, context, occurred_at)
        VALUES
          (
            'traffic.page_view',
            'http',
            'frontend.web',
            120,
            true,
            'traffic-1',
            '{"externalReferrer": true}'::jsonb,
            '{"pathname":"/admin/dashboard","fullPath":"/admin/dashboard?tab=traffic","sessionId":"sess-a","referrerHost":"google.com","viewport":{"width":1440,"height":900}}'::jsonb,
            '2026-03-08T10:00:00.000Z'
          ),
          (
            'traffic.page_view',
            'http',
            'frontend.web',
            60,
            true,
            'traffic-2',
            '{}'::jsonb,
            '{"fullPath":"/admin/dashboard?tab=traffic","sessionId":"sess-a"}'::jsonb,
            '2026-03-08T12:00:00.000Z'
          ),
          (
            'traffic.page_view',
            'http',
            'frontend.web',
            30,
            true,
            'traffic-3',
            '{"pathname":"/from-tag"}'::jsonb,
            '{"sessionId":"sess-b"}'::jsonb,
            '2026-03-10T09:00:00.000Z'
          ),
          (
            'http.request.duration',
            'http',
            'express',
            10,
            true,
            'other-metric',
            '{}'::jsonb,
            '{}'::jsonb,
            '2026-03-08T09:00:00.000Z'
          )
      `,
    );

    const adminLogin = await login(admin.email);
    const response = await request(app)
      .get(
        "/api/v1/metrics/performance/traffic?from=2026-03-08T00:00:00.000Z&to=2026-03-10T23:59:59.999Z&limitRecent=5&limitRoutes=5&limitReferrers=5",
      )
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(response.body.overview).toEqual({
      pageViews: 3,
      uniqueSessions: 2,
      trackedRoutes: 3,
      externalReferrals: 1,
    });
    expect(response.body.viewsByDay).toEqual([
      { date: "2026-03-08", views: 2 },
      { date: "2026-03-09", views: 0 },
      { date: "2026-03-10", views: 1 },
    ]);
    expect(response.body.routes).toEqual([
      expect.objectContaining({
        path: "/admin/dashboard?tab=traffic",
        views: 1,
        uniqueSessions: 1,
      }),
      expect.objectContaining({
        path: "/admin/dashboard",
        views: 1,
        uniqueSessions: 1,
      }),
      expect.objectContaining({
        path: "/from-tag",
        views: 1,
        uniqueSessions: 1,
      }),
    ]);
    expect(response.body.referrers).toEqual([{ referrer: "google.com", views: 1 }]);
    expect(response.body.recentViews[0]).toEqual(
      expect.objectContaining({
        path: null,
        fullPath: null,
        sessionId: "sess-b",
        durationMs: 30,
      }),
    );
  });

  test("global counts returns total procedural entities for admin", async () => {
    const adminLogin = await login(admin.email);
    const response = await request(app)
      .get("/api/v1/galaxies/counts/global")
      .set("Cookie", adminLogin.cookies)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        galaxies: expect.any(Number),
        systems: expect.any(Number),
        stars: expect.any(Number),
        planets: expect.any(Number),
        moons: expect.any(Number),
        asteroids: expect.any(Number),
      }),
    );
    expect(response.body.galaxies).toBeGreaterThanOrEqual(2);
    expect(response.body.systems).toBeGreaterThanOrEqual(2);
  });

  test("global counts forbids non-admin users", async () => {
    const userALogin = await login(userA.email);
    await request(app)
      .get("/api/v1/galaxies/counts/global")
      .set("Cookie", userALogin.cookies)
      .expect(403);
  });

  test("donation lifecycle enforces owner access", async () => {
    const userALogin = await login(userA.email);
    const userBLogin = await login(userB.email);

    const created = await request(app)
      .post("/api/v1/donations/checkout")
      .set("Cookie", userALogin.cookies)
      .send({
        donationType: "monthly",
        amountMinor: 999,
        currency: "USD",
        successUrl: "https://app.local/success",
        cancelUrl: "https://app.local/cancel",
      })
      .expect(201);

    const donationId = created.body.donationId as string;
    const sessionId = created.body.sessionId as string;
    expect(donationId).toBeDefined();
    expect(sessionId).toBeDefined();

    await request(app)
      .get(`/api/v1/donations/${donationId}`)
      .set("Cookie", userBLogin.cookies)
      .expect(403);

    await request(app)
      .post(`/api/v1/donations/checkout/${sessionId}/confirm`)
      .set("Cookie", userALogin.cookies)
      .expect(204);

    const progress = await request(app)
      .get("/api/v1/users/me/supporter-progress")
      .set("Cookie", userALogin.cookies)
      .expect(200);

    expect(Number(progress.body.totalDonatedEurMinor)).toBeGreaterThan(0);
    expect(Number(progress.body.monthlySupportingMonths)).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(progress.body.unlockedBadges)).toBe(true);
  });
});
