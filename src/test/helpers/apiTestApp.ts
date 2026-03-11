// @ts-nocheck
import Express, { Express as ExpressApp } from "express";
import { AuthMiddleware } from "../../presentation/middlewares/Auth.middleware";
import { ScopeMiddleware } from "../../presentation/middlewares/Scope.middleware.ts";
import { buildApiRouter } from "../../presentation/routes";
import { UserController } from "../../presentation/controllers/User.controller";
import { GalaxyController } from "../../presentation/controllers/Galaxy.controller";
import { SystemController } from "../../presentation/controllers/System.controller";
import { StarController } from "../../presentation/controllers/Star.controller";
import { PlanetController } from "../../presentation/controllers/Planet.controller";
import { MoonController } from "../../presentation/controllers/Moon.controller";
import { AsteroidController } from "../../presentation/controllers/Asteroid.controller";
import { LogController } from "../../presentation/controllers/Log.controller";
import { MetricController } from "../../presentation/controllers/Metric.controller";
import { DonationController } from "../../presentation/controllers/Donation.controller";
import { IJWT, JwtClaims } from "../../app/interfaces/Jwt.port";

export const IDS = {
  admin: "11111111-1111-4111-8111-111111111111",
  userA: "22222222-2222-4222-8222-222222222222",
  userB: "33333333-3333-4333-8333-333333333333",
  galaxyA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  galaxyB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  systemA: "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa",
  systemB: "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb",
  starA: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  starB: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
  planetA: "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa",
  planetB: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  moonA: "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa",
  moonB: "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
  asteroidA: "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa",
  asteroidB: "bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb",
} as const;

type GalaxyEntity = { id: string; ownerId: string; name: string; shape: string };
type SystemEntity = { id: string; galaxyId: string; name: string; x: number; y: number; z: number };
type StarEntity = { id: string; systemId: string; name: string };
type PlanetEntity = { id: string; systemId: string; name: string };
type MoonEntity = { id: string; planetId: string; name: string };
type AsteroidEntity = { id: string; systemId: string; name: string };

class FakeJwt implements IJWT {
  signAccessToken(): string {
    return "";
  }

  signRefreshToken(): string {
    return "";
  }

  verifyAccessToken(token: string): JwtClaims {
    const [sub, userRole] = token.split("|");
    if (!sub || !userRole) {
      throw new Error("Invalid token");
    }
    return { sub, userRole, kind: "access" };
  }

  verifyRefreshToken(): JwtClaims {
    throw new Error("Not implemented");
  }
}

const asId = (value: string | { toString(): string }): string => value.toString();
const asName = (value: string | { toString(): string }): string => value.toString();

function buildMockUser(input?: Partial<Record<string, unknown>>) {
  const base = {
    id: IDS.userA,
    email: "a@test.com",
    username: "user_a",
    role: "User",
    isVerified: true,
    isDeleted: false,
    isArchived: false,
    isSupporter: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    lastActivityAt: new Date("2026-01-02T00:00:00.000Z"),
    verifiedAt: new Date("2026-01-01T00:05:00.000Z"),
    deletedAt: null,
    archivedAt: null,
    supporterFrom: null,
  };

  return { ...base, ...(input ?? {}) };
}

export function makeAuthHeader(userId: string, role: "Admin" | "User"): string {
  return `Bearer ${userId}|${role}`;
}

export function buildTestApi(): {
  app: ExpressApp;
  mocks: Record<string, Record<string, jest.Mock>>;
} {
  const galaxies = new Map<string, GalaxyEntity>([
    [IDS.galaxyA, { id: IDS.galaxyA, ownerId: IDS.userA, name: "AlphaPrime", shape: "spherical" }],
    [IDS.galaxyB, { id: IDS.galaxyB, ownerId: IDS.userB, name: "BetaPrime", shape: "irregular" }],
  ]);
  const systems = new Map<string, SystemEntity>([
    [
      IDS.systemA,
      { id: IDS.systemA, galaxyId: IDS.galaxyA, name: "A-System", x: 10, y: 20, z: 30 },
    ],
    [
      IDS.systemB,
      { id: IDS.systemB, galaxyId: IDS.galaxyB, name: "B-System", x: 15, y: 25, z: 35 },
    ],
  ]);
  const stars = new Map<string, StarEntity>([
    [IDS.starA, { id: IDS.starA, systemId: IDS.systemA, name: "StarA" }],
    [IDS.starB, { id: IDS.starB, systemId: IDS.systemB, name: "StarB" }],
  ]);
  const planets = new Map<string, PlanetEntity>([
    [IDS.planetA, { id: IDS.planetA, systemId: IDS.systemA, name: "PlanetA" }],
    [IDS.planetB, { id: IDS.planetB, systemId: IDS.systemB, name: "PlanetB" }],
  ]);
  const moons = new Map<string, MoonEntity>([
    [IDS.moonA, { id: IDS.moonA, planetId: IDS.planetA, name: "MoonA" }],
    [IDS.moonB, { id: IDS.moonB, planetId: IDS.planetB, name: "MoonB" }],
  ]);
  const asteroids = new Map<string, AsteroidEntity>([
    [IDS.asteroidA, { id: IDS.asteroidA, systemId: IDS.systemA, name: "AST-789" }],
    [IDS.asteroidB, { id: IDS.asteroidB, systemId: IDS.systemB, name: "AST-900" }],
  ]);

  const mocks = {
    healthCheck: {
      execute: jest.fn(async () => ({ service: "auth", status: "ok" })),
    },
    findUser: {
      byId: jest.fn(async () => buildMockUser()),
      byEmail: jest.fn(async () => buildMockUser()),
      byUsername: jest.fn(async () => buildMockUser()),
    },
    listUsers: {
      execute: jest.fn(async () => ({ rows: [], total: 0 })),
    },
    authService: {
      login: jest.fn(async () => ({
        user: buildMockUser(),
        accessToken: "a",
        refreshToken: "b",
      })),
      refresh: jest.fn(async () => ({ accessToken: "a2", refreshToken: "b2" })),
      logout: jest.fn(async () => undefined),
      logoutByRefreshToken: jest.fn(async () => undefined),
      logoutAll: jest.fn(async () => undefined),
    },
    platformService: {
      signup: jest.fn(async () => buildMockUser({ isVerified: false, verifiedAt: null })),
      createAdmin: jest.fn(async () =>
        buildMockUser({
          id: "44444444-4444-4444-8444-444444444444",
          email: "admin.created@test.com",
          username: "admin_created",
          role: "Admin",
          isVerified: true,
          verifiedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
      ),
      changeEmail: jest.fn(async () => undefined),
      changePassword: jest.fn(async () => undefined),
      changeUsername: jest.fn(async () => undefined),
      changeRole: jest.fn(async () => undefined),
      verify: jest.fn(async () => undefined),
      resendVerification: jest.fn(async () => undefined),
    },
    lifecycleService: {
      softDelete: jest.fn(async () => undefined),
      restore: jest.fn(async () => undefined),
    },
    securityBanService: {
      isUserBanned: jest.fn(async () => false),
      isIpBanned: jest.fn(async () => false),
      normalizeIp: jest.fn((value: string) => value),
      banUserByAdmin: jest.fn(async (input: Record<string, unknown>) => ({
        id: "1",
        userId: input.targetUserId,
        reason: input.reason ?? "manual",
        source: "admin",
        bannedBy: input.actorUserId ?? null,
        createdAt: new Date(),
        expiresAt: input.expiresAt ?? null,
      })),
      unbanUserByAdmin: jest.fn(async () => 1),
      banIpByAdmin: jest.fn(async (input: Record<string, unknown>) => ({
        id: "1",
        ipAddress: input.ipAddress,
        reason: input.reason ?? "manual",
        source: "admin",
        bannedBy: input.actorUserId ?? null,
        createdAt: new Date(),
        expiresAt: input.expiresAt ?? null,
      })),
      unbanIpByAdmin: jest.fn(async () => 1),
      listActiveBans: jest.fn(async () => ({ users: [], ips: [] })),
      registerSuspiciousSignal: jest.fn(async () => undefined),
      assertIpNotBanned: jest.fn(async () => undefined),
      assertUserNotBanned: jest.fn(async () => undefined),
    },
    createGalaxy: {
      execute: jest.fn(
        async (payload: {
          ownerId: string;
          name: string;
          shape?: string;
          systemCount: number;
        }) => ({
          id: IDS.galaxyA,
          ownerId: payload.ownerId,
          name: payload.name,
          shape: payload.shape ?? "spherical",
        }),
      ),
    },
    changeGalaxyName: { execute: jest.fn(async () => undefined) },
    changeGalaxyShape: { execute: jest.fn(async () => undefined) },
    deleteGalaxy: { execute: jest.fn(async () => undefined) },
    findGalaxy: {
      byId: jest.fn(async (id: string | { toString(): string }) => galaxies.get(asId(id)) ?? null),
      byOwner: jest.fn(async (ownerId: string | { toString(): string }) => {
        const owner = asId(ownerId);
        return Array.from(galaxies.values()).find((g) => g.ownerId === owner) ?? null;
      }),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(galaxies.values()).find((g) => g.name === n) ?? null;
      }),
    },
    listGalaxies: {
      execute: jest.fn(async () => ({ rows: Array.from(galaxies.values()), total: galaxies.size })),
    },
    populateGalaxy: {
      execute: jest.fn(async (id: string | { toString(): string }) => ({
        galaxy: galaxies.get(asId(id)),
        systems: Array.from(systems.values()).filter((s) => s.galaxyId === asId(id)),
      })),
    },
    getGalaxyAggregateCounts: {
      execute: jest.fn(async (id: string | { toString(): string }) => {
        const galaxyId = asId(id);
        const galaxySystems = Array.from(systems.values()).filter((s) => s.galaxyId === galaxyId);
        const systemIds = new Set(galaxySystems.map((s) => s.id));
        const galaxyPlanets = Array.from(planets.values()).filter((p) => systemIds.has(p.systemId));
        const planetIds = new Set(galaxyPlanets.map((p) => p.id));

        return {
          systems: galaxySystems.length,
          stars: Array.from(stars.values()).filter((s) => systemIds.has(s.systemId)).length,
          planets: galaxyPlanets.length,
          moons: Array.from(moons.values()).filter((m) => planetIds.has(m.planetId)).length,
          asteroids: Array.from(asteroids.values()).filter((a) => systemIds.has(a.systemId)).length,
        };
      }),
    },
    getGlobalProceduralCounts: {
      execute: jest.fn(async () => ({
        galaxies: galaxies.size,
        systems: systems.size,
        stars: stars.size,
        planets: planets.size,
        moons: moons.size,
        asteroids: asteroids.size,
      })),
    },
    findSystem: {
      byId: jest.fn(async (id: string | { toString(): string }) => systems.get(asId(id)) ?? null),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(systems.values()).find((s) => s.name === n) ?? null;
      }),
      byPosition: jest.fn(
        async (input: { x: number; y: number; z: number }) =>
          Array.from(systems.values()).find(
            (s) => s.x === input.x && s.y === input.y && s.z === input.z,
          ) ?? null,
      ),
    },
    listSystemsByGalaxy: {
      execute: jest.fn(async (galaxyId: string | { toString(): string }) => {
        const id = asId(galaxyId);
        const rows = Array.from(systems.values()).filter((s) => s.galaxyId === id);
        return { rows, total: rows.length };
      }),
    },
    changeSystemName: { execute: jest.fn(async () => undefined) },
    changeSystemPosition: { execute: jest.fn(async () => undefined) },
    findStar: {
      byId: jest.fn(async (id: string | { toString(): string }) => stars.get(asId(id)) ?? null),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(stars.values()).find((s) => s.name === n) ?? null;
      }),
    },
    listStarsBySystem: {
      execute: jest.fn(async (systemId: string | { toString(): string }) => {
        const id = asId(systemId);
        const rows = Array.from(stars.values()).filter((s) => s.systemId === id);
        return { rows, total: rows.length };
      }),
    },
    changeStarName: { execute: jest.fn(async () => undefined) },
    changeStarMain: { execute: jest.fn(async () => undefined) },
    changeStarOrbital: { execute: jest.fn(async () => undefined) },
    changeStarStarterOrbital: { execute: jest.fn(async () => undefined) },
    findPlanet: {
      byId: jest.fn(async (id: string | { toString(): string }) => planets.get(asId(id)) ?? null),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(planets.values()).find((s) => s.name === n) ?? null;
      }),
    },
    listPlanetsBySystem: {
      execute: jest.fn(async (systemId: string | { toString(): string }) => {
        const id = asId(systemId);
        const rows = Array.from(planets.values()).filter((s) => s.systemId === id);
        return { rows, total: rows.length };
      }),
    },
    changePlanetName: { execute: jest.fn(async () => undefined) },
    changePlanetOrbital: { execute: jest.fn(async () => undefined) },
    changePlanetBiome: { execute: jest.fn(async () => undefined) },
    findMoon: {
      byId: jest.fn(async (id: string | { toString(): string }) => moons.get(asId(id)) ?? null),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(moons.values()).find((s) => s.name === n) ?? null;
      }),
    },
    listMoonsByPlanet: {
      execute: jest.fn(async (planetId: string | { toString(): string }) => {
        const id = asId(planetId);
        const rows = Array.from(moons.values()).filter((s) => s.planetId === id);
        return { rows, total: rows.length };
      }),
    },
    changeMoonName: { execute: jest.fn(async () => undefined) },
    changeMoonSize: { execute: jest.fn(async () => undefined) },
    changeMoonOrbital: { execute: jest.fn(async () => undefined) },
    findAsteroid: {
      byId: jest.fn(async (id: string | { toString(): string }) => asteroids.get(asId(id)) ?? null),
      byName: jest.fn(async (name: string | { toString(): string }) => {
        const n = asName(name);
        return Array.from(asteroids.values()).find((s) => s.name === n) ?? null;
      }),
    },
    listAsteroidsBySystem: {
      execute: jest.fn(async (systemId: string | { toString(): string }) => {
        const id = asId(systemId);
        const rows = Array.from(asteroids.values()).filter((s) => s.systemId === id);
        return { rows, total: rows.length };
      }),
    },
    changeAsteroidName: { execute: jest.fn(async () => undefined) },
    changeAsteroidType: { execute: jest.fn(async () => undefined) },
    changeAsteroidSize: { execute: jest.fn(async () => undefined) },
    changeAsteroidOrbital: { execute: jest.fn(async () => undefined) },
    createLog: {
      execute: jest.fn(async (payload: Record<string, unknown>) => ({
        id: "1",
        ...payload,
        occurredAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      })),
    },
    resolveLog: { execute: jest.fn(async () => undefined) },
    reopenLog: { execute: jest.fn(async () => undefined) },
    setAdminNote: { execute: jest.fn(async () => undefined) },
    clearAdminNote: { execute: jest.fn(async () => undefined) },
    findLog: {
      byId: jest.fn(async (id: string) => ({
        id,
        source: "http",
        level: "warn",
        category: "security",
        message: "Forbidden",
        userId: IDS.userA,
        requestId: "req-mock-1",
        method: "GET",
        path: "/api/v1/galaxies",
        statusCode: 403,
        ip: "192.168.1.50",
        userAgent: "MockedAgent/1.0",
        fingerprint: "fp_mocked_1234567890",
        tags: ["auth", "forbidden"],
        context: {
          reason: "ownership_denied",
          authorization: "Bearer secret-token",
        },
        occurredAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
        adminNote: null,
        adminNoteUpdatedAt: null,
        adminNoteUpdatedBy: null,
      })),
    },
    listLogs: {
      execute: jest.fn(async () => ({ rows: [], total: 0 })),
    },
    trackMetric: {
      execute: jest.fn(async (payload: Record<string, unknown>) => ({
        id: "1",
        ...payload,
        occurredAt: new Date(),
      })),
    },
    findMetric: {
      byId: jest.fn(async (id: string) => ({
        id,
        metricName: "http.request.duration",
        metricType: "http",
        source: "express",
        durationMs: 10,
        success: true,
        userId: IDS.userA,
        requestId: "req-metric-1",
        tags: { feature: "dashboard" },
        context: { authorization: "Bearer metric-token" },
        occurredAt: new Date(),
      })),
    },
    listMetrics: {
      execute: jest.fn(async () => ({ rows: [], total: 0 })),
    },
    dashboardMetrics: {
      execute: jest.fn(async () => ({
        from: new Date(),
        to: new Date(),
        summary: {
          total: 0,
          avgDurationMs: 0,
          p95DurationMs: 0,
          p99DurationMs: 0,
          maxDurationMs: 0,
          errorRate: 0,
        },
        byType: [],
        topBottlenecks: [],
        recentFailures: [],
      })),
    },
    trafficAnalytics: {
      execute: jest.fn(async () => ({
        overview: {
          pageViews: 3,
          uniqueSessions: 2,
          trackedRoutes: 2,
          externalReferrals: 1,
        },
        viewsByDay: [{ date: "2026-03-10", views: 3 }],
        routes: [
          { path: "/admin", views: 2, uniqueSessions: 2, avgDurationMs: 30 },
          { path: "unknown", views: 1, uniqueSessions: 0, avgDurationMs: 10 },
        ],
        referrers: [{ referrer: "google.com", views: 1 }],
        recentViews: [],
      })),
    },
    createDonationCheckout: {
      execute: jest.fn(async () => ({
        checkoutUrl: "https://checkout.stripe.com/pay/mock",
        donationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        sessionId: "cs_test_mock",
      })),
    },
    confirmDonationBySession: {
      execute: jest.fn(async () => undefined),
    },
    cancelDonation: {
      execute: jest.fn(async () => undefined),
    },
    findDonation: {
      byId: jest.fn(async (id: string) => ({
        id,
        userId: IDS.userA,
        donationType: "monthly",
        amountMinor: 999,
        currency: "USD",
        status: "active",
        provider: "stripe",
        providerSessionId: "cs_test_dashboard_sensitive",
        providerCustomerId: "cus_dashboard_sensitive",
        providerSubscriptionId: "sub_dashboard_sensitive",
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        canceledAt: null,
      })),
      byProviderSessionId: jest.fn(async () => ({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        userId: IDS.userA,
        donationType: "monthly",
        status: "pending",
      })),
    },
    listDonations: {
      execute: jest.fn(async () => ({ rows: [], total: 0 })),
    },
    listSupporterBadges: {
      execute: jest.fn(async () => ({
        rows: [
          {
            id: 1,
            branch: "amount",
            level: 1,
            name: "Bronze Patron",
            quantityLabel: "5 EUR",
            threshold: 500,
          },
          {
            id: 7,
            branch: "months",
            level: 1,
            name: "Monthly Initiate",
            quantityLabel: "1 month",
            threshold: 1,
          },
        ],
        total: 2,
      })),
    },
    getSupporterProgress: {
      execute: jest.fn(async () => ({
        totalDonatedEurMinor: 919,
        monthlySupportingMonths: 1,
        unlockedBadges: [
          {
            branch: "amount",
            level: 1,
            name: "Bronze Patron",
            quantityLabel: "5 EUR",
            threshold: 500,
            unlockedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            branch: "months",
            level: 1,
            name: "Monthly Initiate",
            quantityLabel: "1 month",
            threshold: 1,
            unlockedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        amountBranch: {
          level: 1,
          maxLevel: 6,
          nextLevel: 2,
          nextThreshold: 2000,
          currentBadge: {
            branch: "amount",
            level: 1,
            name: "Bronze Patron",
            quantityLabel: "5 EUR",
            threshold: 500,
          },
          nextBadge: {
            branch: "amount",
            level: 2,
            name: "Silver Patron",
            quantityLabel: "20 EUR",
            threshold: 2000,
          },
        },
        monthlyBranch: {
          level: 1,
          maxLevel: 7,
          nextLevel: 2,
          nextThreshold: 3,
          currentBadge: {
            branch: "months",
            level: 1,
            name: "Monthly Initiate",
            quantityLabel: "1 month",
            threshold: 1,
          },
          nextBadge: {
            branch: "months",
            level: 2,
            name: "Monthly Cadet",
            quantityLabel: "3 months",
            threshold: 3,
          },
        },
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      })),
    },
  } as const;

  const userController = new UserController(
    mocks.healthCheck as any,
    mocks.findUser as any,
    mocks.listUsers as any,
    mocks.authService as any,
    mocks.platformService as any,
    mocks.lifecycleService as any,
    mocks.securityBanService as any,
    mocks.getSupporterProgress as any,
  );

  const galaxyController = new GalaxyController(
    mocks.createGalaxy as any,
    mocks.changeGalaxyName as any,
    mocks.changeGalaxyShape as any,
    mocks.deleteGalaxy as any,
    mocks.findGalaxy as any,
    mocks.listGalaxies as any,
    mocks.populateGalaxy as any,
    mocks.getGalaxyAggregateCounts as any,
    mocks.getGlobalProceduralCounts as any,
  );

  const systemController = new SystemController(
    mocks.findSystem as any,
    mocks.listSystemsByGalaxy as any,
    mocks.changeSystemName as any,
    mocks.changeSystemPosition as any,
    mocks.findGalaxy as any,
  );

  const starController = new StarController(
    mocks.findStar as any,
    mocks.listStarsBySystem as any,
    mocks.changeStarName as any,
    mocks.changeStarMain as any,
    mocks.changeStarOrbital as any,
    mocks.changeStarStarterOrbital as any,
    mocks.findSystem as any,
    mocks.findGalaxy as any,
  );

  const planetController = new PlanetController(
    mocks.findPlanet as any,
    mocks.listPlanetsBySystem as any,
    mocks.changePlanetName as any,
    mocks.changePlanetOrbital as any,
    mocks.changePlanetBiome as any,
    mocks.findSystem as any,
    mocks.findGalaxy as any,
  );

  const moonController = new MoonController(
    mocks.findMoon as any,
    mocks.listMoonsByPlanet as any,
    mocks.changeMoonName as any,
    mocks.changeMoonSize as any,
    mocks.changeMoonOrbital as any,
    mocks.findPlanet as any,
    mocks.findSystem as any,
    mocks.findGalaxy as any,
  );

  const asteroidController = new AsteroidController(
    mocks.findAsteroid as any,
    mocks.listAsteroidsBySystem as any,
    mocks.changeAsteroidName as any,
    mocks.changeAsteroidType as any,
    mocks.changeAsteroidSize as any,
    mocks.changeAsteroidOrbital as any,
    mocks.findSystem as any,
    mocks.findGalaxy as any,
  );
  const logController = new LogController(
    mocks.createLog as any,
    mocks.resolveLog as any,
    mocks.reopenLog as any,
    mocks.setAdminNote as any,
    mocks.clearAdminNote as any,
    mocks.findLog as any,
    mocks.listLogs as any,
  );
  const metricController = new MetricController(
    mocks.trackMetric as any,
    mocks.findMetric as any,
    mocks.listMetrics as any,
    mocks.dashboardMetrics as any,
    mocks.trafficAnalytics as any,
  );
  const donationController = new DonationController(
    mocks.createDonationCheckout as any,
    mocks.confirmDonationBySession as any,
    mocks.cancelDonation as any,
    mocks.findDonation as any,
    mocks.listDonations as any,
    mocks.listSupporterBadges as any,
  );

  const app = Express();
  app.use(Express.json());
  const auth = new AuthMiddleware(new FakeJwt(), {}, mocks.securityBanService as any);
  const scope = new ScopeMiddleware();

  app.use(
    buildApiRouter({
      userController,
      galaxyController,
      systemController,
      starController,
      planetController,
      moonController,
      asteroidController,
      logController,
      metricController,
      donationController,
      auth,
      scope,
    }),
  );

  return { app, mocks: mocks as unknown as Record<string, Record<string, jest.Mock>> };
}
