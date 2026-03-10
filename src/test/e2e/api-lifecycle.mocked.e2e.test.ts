import request from "supertest";
import { buildTestApi, IDS, makeAuthHeader } from "../helpers/apiTestApp";
import { RUN_REAL_INFRA_TESTS } from "../helpers/realInfra";

const describeMocked = RUN_REAL_INFRA_TESTS ? describe.skip : describe;

describeMocked("API E2E (mocked) - auth, ownership and validation boundaries", () => {
  test("rejects protected endpoints when Authorization header is missing", async () => {
    const { app } = buildTestApi();
    await request(app).get("/api/v1/galaxies").expect(401);
  });

  test("sets access and refresh cookies on login", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .post("/api/v1/users/login")
      .send({ email: "a@test.com", rawPassword: "123456" })
      .expect(200);

    const rawSetCookie = response.headers["set-cookie"];
    const setCookie = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
        ? [rawSetCookie]
        : [];
    expect(setCookie.some((value: string) => value.startsWith("access_token="))).toBe(true);
    expect(setCookie.some((value: string) => value.startsWith("refresh_token="))).toBe(true);
  });

  test("uses refresh token from cookie in refresh endpoint", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post("/api/v1/users/token/refresh")
      .set("Cookie", ["refresh_token=valid.refresh.token"])
      .expect(200);
    expect(mocks.authService.refresh).toHaveBeenCalledWith("valid.refresh.token");
  });

  test("rejects refresh without cookie when body is invalid", async () => {
    const { app, mocks } = buildTestApi();
    await request(app).post("/api/v1/users/token/refresh").send({}).expect(400);
    expect(mocks.authService.refresh).not.toHaveBeenCalled();
  });

  test("allows any authenticated user to create galaxies and injects ownerId from auth context", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post("/api/v1/galaxies")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ name: "NewGalaxy", shape: "spherical", systemCount: 3 })
      .expect(201);

    expect(mocks.createGalaxy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: IDS.userA,
        name: "NewGalaxy",
        systemCount: 3,
      }),
    );
  });

  test("rejects galaxy creation when systemCount exceeds 1000", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post("/api/v1/galaxies")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ name: "BoundTest", shape: "spherical", systemCount: 1001 })
      .expect(400);

    expect(mocks.createGalaxy.execute).not.toHaveBeenCalled();
  });

  test("allows only admin to list users", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .get("/api/v1/users")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .expect(403);

    await request(app)
      .get("/api/v1/users?limit=20")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(mocks.listUsers.execute).toHaveBeenCalled();
  });

  test("forbids non-owner from mutating systems", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch(`/api/v1/systems/${IDS.systemB}/name`)
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ name: "ForbiddenSystem" })
      .expect(403);
    expect(mocks.changeSystemName.execute).not.toHaveBeenCalled();
  });

  test("forbids non-owner from mutating stars", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch(`/api/v1/stars/${IDS.starB}/main`)
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ isMain: true })
      .expect(403);
    expect(mocks.changeStarMain.execute).not.toHaveBeenCalled();
  });

  test("returns aggregate counts for a galaxy", async () => {
    const { app, mocks } = buildTestApi();
    const response = await request(app)
      .get(`/api/v1/galaxies/${IDS.galaxyA}/counts`)
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .expect(200);

    expect(response.body).toEqual({
      systems: 1,
      stars: 1,
      planets: 1,
      moons: 1,
      asteroids: 1,
    });
    expect(mocks.getGalaxyAggregateCounts.execute).toHaveBeenCalled();
  });

  test("returns global procedural totals for admin", async () => {
    const { app, mocks } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/galaxies/counts/global")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body).toEqual({
      galaxies: 2,
      systems: 2,
      stars: 2,
      planets: 2,
      moons: 2,
      asteroids: 2,
    });
    expect(mocks.getGlobalProceduralCounts.execute).toHaveBeenCalled();
  });

  test("returns dedicated traffic analytics for admin", async () => {
    const { app, mocks } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/metrics/performance/traffic?from=2026-03-08T00:00:00.000Z&to=2026-03-10T23:59:59.999Z&limitRecent=5&limitRoutes=7&limitReferrers=3")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        overview: expect.objectContaining({
          pageViews: expect.any(Number),
          uniqueSessions: expect.any(Number),
          trackedRoutes: expect.any(Number),
          externalReferrals: expect.any(Number),
        }),
        viewsByDay: expect.any(Array),
        routes: expect.any(Array),
        referrers: expect.any(Array),
        recentViews: expect.any(Array),
      }),
    );
    expect(mocks.trafficAnalytics.execute).toHaveBeenCalledWith({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-10T23:59:59.999Z"),
      limitRecent: 5,
      limitRoutes: 7,
      limitReferrers: 3,
    });
  });

  test("normalizes date-only traffic analytics boundaries to full UTC days", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .get("/api/v1/metrics/performance/traffic?from=2026-03-08&to=2026-03-10")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(mocks.trafficAnalytics.execute).toHaveBeenCalledWith({
      from: new Date("2026-03-08T00:00:00.000Z"),
      to: new Date("2026-03-10T23:59:59.999Z"),
    });
  });

  test("forbids global procedural totals for non-admin", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .get("/api/v1/galaxies/counts/global")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .expect(403);

    expect(mocks.getGlobalProceduralCounts.execute).not.toHaveBeenCalled();
  });

  test("allows admin to resolve logs", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/logs/10/resolve")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(204);
    expect(mocks.resolveLog.execute).toHaveBeenCalledWith("10", IDS.admin);
  });

  test("allows admin to reopen logs", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/logs/10/reopen")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(204);
    expect(mocks.reopenLog.execute).toHaveBeenCalledWith("10");
  });

  test("allows admin to set a log note", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/logs/10/admin-note")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .send({ note: "Investigating root cause" })
      .expect(204);
    expect(mocks.setAdminNote.execute).toHaveBeenCalledWith(
      "10",
      "Investigating root cause",
      IDS.admin,
    );
  });

  test("allows admin to clear a log note", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .delete("/api/v1/logs/10/admin-note")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(204);
    expect(mocks.clearAdminNote.execute).toHaveBeenCalledWith("10", IDS.admin);
  });

  test("returns raw log dashboard data for admin without masking", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/logs/10?view=dashboard")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body.context).toEqual({
      reason: "ownership_denied",
      authorization: "Bearer secret-token",
    });
    expect(response.body.ip).toBe("192.168.1.50");
    expect(response.body.fingerprint).toBe("fp_mocked_1234567890");
    expect(response.body).not.toHaveProperty("ipMasked");
    expect(response.body).not.toHaveProperty("fingerprintMasked");
  });

  test("keeps log list dashboard view sanitized", async () => {
    const { app, mocks } = buildTestApi();
    const logRow = await (mocks.findLog.byId as jest.Mock)("10");
    (mocks.listLogs.execute as jest.Mock).mockResolvedValueOnce({
      rows: [logRow],
      total: 1,
    });

    const response = await request(app)
      .get("/api/v1/logs?view=dashboard")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body.rows[0].context).toEqual({
      reason: "ownership_denied",
      authorization: "[REDACTED]",
    });
    expect(response.body.rows[0].ipMasked).toBe("192.168.1.***");
    expect(response.body.rows[0].fingerprintMasked).toBe("fp_m...7890");
    expect(response.body.rows[0]).not.toHaveProperty("ip");
    expect(response.body.rows[0]).not.toHaveProperty("fingerprint");
  });

  test("allows authenticated users to create donation checkout sessions", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post("/api/v1/donations/checkout")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({
        donationType: "monthly",
        amountMinor: 999,
        currency: "USD",
        successUrl: "https://app.local/success",
        cancelUrl: "https://app.local/cancel",
      })
      .expect(201);

    expect(mocks.createDonationCheckout.execute).toHaveBeenCalled();
  });

  test("rejects supporter badge catalog when auth is missing", async () => {
    const { app } = buildTestApi();
    await request(app).get("/api/v1/donations/badges").expect(401);
  });

  test("returns the full supporter badge catalog for authenticated users", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/donations/badges")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .expect(200);

    expect(response.body.total).toBeGreaterThan(0);
    expect(Array.isArray(response.body.rows)).toBe(true);
    expect(response.body.rows[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        branch: expect.any(String),
        level: expect.any(Number),
        name: expect.any(String),
        quantityLabel: expect.any(String),
        threshold: expect.any(Number),
      }),
    );
  });

  test("returns extended but sanitized admin dashboard user view", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .get(`/api/v1/users/${IDS.userA}?view=dashboard`)
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body.user).toHaveProperty("verificationCodeActive");
    expect(response.body.user).toHaveProperty("verificationCodeExpiresAt");
    expect(response.body.user).not.toHaveProperty("passwordHash");
    expect(response.body.user).not.toHaveProperty("verificationCode");
  });

  test("returns extended dashboard donation view with masked provider identifiers", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/donations/dddddddd-dddd-4ddd-8ddd-dddddddddddd?view=dashboard")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(200);

    expect(response.body).toHaveProperty("provider", "stripe");
    expect(response.body).toHaveProperty("providerSessionIdMasked");
    expect(response.body).not.toHaveProperty("providerSessionId");
  });

  test("returns supporter badge progress for current user", async () => {
    const { app } = buildTestApi();
    const response = await request(app)
      .get("/api/v1/users/me/supporter-progress")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        totalDonatedEurMinor: expect.any(Number),
        monthlySupportingMonths: expect.any(Number),
      }),
    );
    expect(Array.isArray(response.body.unlockedBadges)).toBe(true);
    expect(response.body.unlockedBadges[0]).toEqual(
      expect.objectContaining({
        branch: expect.any(String),
        level: expect.any(Number),
        name: expect.any(String),
        quantityLabel: expect.any(String),
        threshold: expect.any(Number),
        unlockedAt: expect.any(String),
      }),
    );
    expect(response.body.amountBranch).toEqual(
      expect.objectContaining({
        level: expect.any(Number),
        maxLevel: expect.any(Number),
        nextLevel: expect.anything(),
        nextThreshold: expect.anything(),
        currentBadge: expect.anything(),
        nextBadge: expect.anything(),
      }),
    );
    expect(response.body.monthlyBranch).toEqual(
      expect.objectContaining({
        level: expect.any(Number),
        maxLevel: expect.any(Number),
        nextLevel: expect.anything(),
        nextThreshold: expect.anything(),
        currentBadge: expect.anything(),
        nextBadge: expect.anything(),
      }),
    );
    expect(response.body.updatedAt).toEqual(expect.any(String));
  });

  test("rejects change password when currentPassword is missing", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ newPassword: "newpass123" })
      .expect(400);

    expect(mocks.platformService.changePassword).not.toHaveBeenCalled();
  });

  test("forwards both current and new password in change password payload", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/users/me/password")
      .set("Authorization", makeAuthHeader(IDS.userA, "User"))
      .send({ currentPassword: "current123", newPassword: "newpass123" })
      .expect(204);

    expect(mocks.platformService.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ toString: expect.any(Function) }),
      {
        currentPassword: "current123",
        newPassword: "newpass123",
      },
    );
  });

  test("allows admin to ban a user", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post(`/api/v1/users/${IDS.userB}/ban`)
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .send({ reason: "Brute force attempts detected" })
      .expect(201);

    expect(mocks.securityBanService.banUserByAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: IDS.userB,
        actorUserId: IDS.admin,
      }),
    );
  });

  test("allows admin to ban an ip", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .post("/api/v1/users/bans/ip")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .send({ ipAddress: "10.0.0.5", reason: "DDoS traffic burst" })
      .expect(201);

    expect(mocks.securityBanService.banIpByAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: "10.0.0.5",
        actorUserId: IDS.admin,
      }),
    );
  });
});
