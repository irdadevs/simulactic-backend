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

  test("allows admin to resolve logs", async () => {
    const { app, mocks } = buildTestApi();
    await request(app)
      .patch("/api/v1/logs/10/resolve")
      .set("Authorization", makeAuthHeader(IDS.admin, "Admin"))
      .expect(204);
    expect(mocks.resolveLog.execute).toHaveBeenCalledWith("10", IDS.admin);
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
});
