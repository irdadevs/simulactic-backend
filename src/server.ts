import dotenv from "dotenv";
dotenv.config();

import Express from "express";
import { Server } from "http";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import { loadAppEnv } from "./config/AppEnv";

import { PgPoolQueryable } from "./infra/db/Postgres";
import { PgUnitOfWorkFactory } from "./infra/db/PostgresUoW";
import { RedisRepo } from "./infra/repos/Redis.repository";
import { CONSOLE_COLORS } from "./utils/Chalk";
import { buildApiRouter } from "./presentation/routes";
import UserRepo from "./infra/repos/User.repository";
import JwtService from "./infra/repos/Jwt.repository";
import { AuthMiddleware } from "./presentation/middlewares/Auth.middleware";
import { ScopeMiddleware } from "./presentation/middlewares/Scope.middleware.ts";
import { SessionRepo } from "./infra/repos/Session.repository";
import { SecurityBanRepo } from "./infra/repos/SecurityBan.repository";
import { LoginUser } from "./app/use-cases/commands/users/LoginUser.command";
import { HasherRepo } from "./infra/repos/Hasher.repository";
import { SignupUser } from "./app/use-cases/commands/users/SignupUser.command";
import { CreateAdmin } from "./app/use-cases/commands/users/CreateAdmin.command";
import { VerifyUser } from "./app/use-cases/commands/users/VerifyUser.command";
import { ChangeEmail } from "./app/use-cases/commands/users/ChangeEmail.command";
import { ChangePassword } from "./app/use-cases/commands/users/ChangePassword.command";
import { ChangeRole } from "./app/use-cases/commands/users/ChangeRole.command";
import { ChangeUsername } from "./app/use-cases/commands/users/ChangeUsername.command";
import { ResendVerificationCode } from "./app/use-cases/commands/users/ResendVerificationCode.command";
import { ListUsers } from "./app/use-cases/queries/users/ListUsers.query";
import { SoftDeleteUser } from "./app/use-cases/commands/users/SoftDeleteUser.command";
import { RestoreUser } from "./app/use-cases/commands/users/RestoreUser.command";
import { AuthService } from "./app/app-services/users/Auth.service";
import { RefreshSession } from "./app/use-cases/commands/users/RefreshSession.command";
import { LogoutSession } from "./app/use-cases/commands/users/LogoutSession.command";
import { LogoutAllSessions } from "./app/use-cases/commands/users/LogoutAllSessions.command";
import { PlatformService } from "./app/app-services/users/Platform.service";
import { LifecycleService } from "./app/app-services/users/Lifecycle.service";
import { UserCacheService } from "./app/app-services/users/UserCache.service";
import { GalaxyCacheService } from "./app/app-services/galaxies/GalaxyCache.service";
import { SystemCacheService } from "./app/app-services/systems/SystemCache.service";
import { StarCacheService } from "./app/app-services/stars/StarCache.service";
import { PlanetCacheService } from "./app/app-services/planets/PlanetCache.service";
import { MoonCacheService } from "./app/app-services/moons/MoonCache.service";
import { AsteroidCacheService } from "./app/app-services/asteroids/AsteroidCache.service";
import { UserController } from "./presentation/controllers/User.controller";
import { GalaxyController } from "./presentation/controllers/Galaxy.controller";
import { SystemController } from "./presentation/controllers/System.controller";
import { StarController } from "./presentation/controllers/Star.controller";
import { PlanetController } from "./presentation/controllers/Planet.controller";
import { MoonController } from "./presentation/controllers/Moon.controller";
import { AsteroidController } from "./presentation/controllers/Asteroid.controller";
import { LogController } from "./presentation/controllers/Log.controller";
import { RequestAuditMiddleware } from "./presentation/middlewares/RequestAudit.middleware";
import { MetricController } from "./presentation/controllers/Metric.controller";
import { DonationController } from "./presentation/controllers/Donation.controller";
import { PerformanceMetricsMiddleware } from "./presentation/middlewares/PerformanceMetrics.middleware";
import { SecurityGuardMiddleware } from "./presentation/middlewares/SecurityGuard.middleware";
import FindUser from "./app/use-cases/queries/users/FindUser.query";
import { HealthQuery } from "./app/use-cases/queries/Health.query";
import { MailerRepo } from "./infra/repos/Mailer.repository";
import GalaxyRepo from "./infra/repos/Galaxy.repository";
import SystemRepo from "./infra/repos/System.repository";
import StarRepo from "./infra/repos/Star.repository";
import PlanetRepo from "./infra/repos/Planet.repository";
import MoonRepo from "./infra/repos/Moon.repository";
import AsteroidRepo from "./infra/repos/Asteroid.repository";
import { CreateGalaxy } from "./app/use-cases/commands/galaxies/CreateGalaxy.command";
import { ChangeGalaxyName } from "./app/use-cases/commands/galaxies/ChangeGalaxyName.command";
import { ChangeGalaxyShape } from "./app/use-cases/commands/galaxies/ChangeGalaxyShape.command";
import { DeleteGalaxy } from "./app/use-cases/commands/galaxies/DeleteGalaxy.command";
import { GalaxyLifecycleService } from "./app/app-services/galaxies/GalaxyLifecycle.service";
import { FindGalaxy } from "./app/use-cases/queries/galaxies/FindGalaxy.query";
import { ListGalaxies } from "./app/use-cases/queries/galaxies/ListGalaxies.query";
import { PopulateGalaxy } from "./app/use-cases/queries/galaxies/PopulateGalaxy.query";
import { GetGalaxyAggregateCounts } from "./app/use-cases/queries/galaxies/GetGalaxyAggregateCounts.query";
import { GetGlobalProceduralCounts } from "./app/use-cases/queries/galaxies/GetGlobalProceduralCounts.query";
import { FindSystem } from "./app/use-cases/queries/systems/FindSystem.query";
import { ListSystemsByGalaxy } from "./app/use-cases/queries/systems/ListSystemsByGalaxy.query";
import { ChangeSystemName } from "./app/use-cases/commands/systems/ChangeSystemName.command";
import { ChangeSystemPosition } from "./app/use-cases/commands/systems/ChangeSystemPosition.command";
import { FindStar } from "./app/use-cases/queries/stars/FindStar.query";
import { ListStarsBySystem } from "./app/use-cases/queries/stars/ListStarsBySystem.query";
import { ChangeStarName } from "./app/use-cases/commands/stars/ChangeStarName.command";
import { ChangeStarMain } from "./app/use-cases/commands/stars/ChangeStarMain.command";
import { ChangeStarOrbital } from "./app/use-cases/commands/stars/ChangeStarOrbital.command";
import { ChangeStarStarterOrbital } from "./app/use-cases/commands/stars/ChangeStarStarterOrbital.command";
import { FindPlanet } from "./app/use-cases/queries/planets/FindPlanet.query";
import { ListPlanetsBySystem } from "./app/use-cases/queries/planets/ListPlanetsBySystem.query";
import { ChangePlanetName } from "./app/use-cases/commands/planets/ChangePlanetName.command";
import { ChangePlanetOrbital } from "./app/use-cases/commands/planets/ChangePlanetOrbital.command";
import { ChangePlanetBiome } from "./app/use-cases/commands/planets/ChangePlanetBiome.command";
import { FindMoon } from "./app/use-cases/queries/moons/FindMoon.query";
import { ListMoonsByPlanet } from "./app/use-cases/queries/moons/ListMoonsByPlanet.query";
import { ChangeMoonName } from "./app/use-cases/commands/moons/ChangeMoonName.command";
import { ChangeMoonSize } from "./app/use-cases/commands/moons/ChangeMoonSize.command";
import { ChangeMoonOrbital } from "./app/use-cases/commands/moons/ChangeMoonOrbital.command";
import { FindAsteroid } from "./app/use-cases/queries/asteroids/FindAsteroid.query";
import { ListAsteroidsBySystem } from "./app/use-cases/queries/asteroids/ListAsteroidsBySystem.query";
import { ChangeAsteroidName } from "./app/use-cases/commands/asteroids/ChangeAsteroidName.command";
import { ChangeAsteroidType } from "./app/use-cases/commands/asteroids/ChangeAsteroidType.command";
import { ChangeAsteroidSize } from "./app/use-cases/commands/asteroids/ChangeAsteroidSize.command";
import { ChangeAsteroidOrbital } from "./app/use-cases/commands/asteroids/ChangeAsteroidOrbital.command";
import LogRepo from "./infra/repos/Log.repository";
import { LogCacheService } from "./app/app-services/logs/LogCache.service";
import { CreateLog } from "./app/use-cases/commands/logs/CreateLog.command";
import { ClearAdminNote } from "./app/use-cases/commands/logs/ClearAdminNote.command";
import { ReopenLog } from "./app/use-cases/commands/logs/ReopenLog.command";
import { ResolveLog } from "./app/use-cases/commands/logs/ResolveLog.command";
import { SetAdminNote } from "./app/use-cases/commands/logs/SetAdminNote.command";
import { FindLog } from "./app/use-cases/queries/logs/FindLog.query";
import { ListLogs } from "./app/use-cases/queries/logs/ListLogs.query";
import MetricRepo from "./infra/repos/Metric.repository";
import DonationRepo from "./infra/repos/Donation.repository";
import { PaymentGatewayRepo } from "./infra/repos/PaymentGateway.repository";
import { MetricCacheService } from "./app/app-services/metrics/MetricCache.service";
import { DonationCacheService } from "./app/app-services/donations/DonationCache.service";
import { TrackMetric } from "./app/use-cases/commands/metrics/TrackMetric.command";
import { FindMetric } from "./app/use-cases/queries/metrics/FindMetric.query";
import { ListMetrics } from "./app/use-cases/queries/metrics/ListMetrics.query";
import { MetricsDashboardQuery } from "./app/use-cases/queries/metrics/MetricsDashboard.query";
import { TrafficAnalyticsQueryService } from "./app/use-cases/queries/metrics/TrafficAnalytics.query";
import { CreateDonationCheckout } from "./app/use-cases/commands/donations/CreateDonationCheckout.command";
import { ConfirmDonationBySession } from "./app/use-cases/commands/donations/ConfirmDonationBySession.command";
import { CancelDonation } from "./app/use-cases/commands/donations/CancelDonation.command";
import { FindDonation } from "./app/use-cases/queries/donations/FindDonation.query";
import { ListDonations } from "./app/use-cases/queries/donations/ListDonations.query";
import { GetSupporterProgress } from "./app/use-cases/queries/donations/GetSupporterProgress.query";
import { ListSupporterBadges } from "./app/use-cases/queries/donations/ListSupporterBadges.query";
import { DbMetricInput } from "./config/db/DbMetrics";
import { MaintenanceScheduler } from "./infra/jobs/Maintenance.scheduler";
import { SecurityBanService } from "./app/app-services/security/SecurityBan.service";

// --------------------
// Server config
// --------------------
const app = Express();
const APP_ENV = loadAppEnv();
const PORT = APP_ENV.PORT;
const IS_PROD = APP_ENV.NODE_ENV === "production";

// --------------------
// Global middlewares
// --------------------
app.set("trust proxy", 1);
app.use(Express.json());
app.use(
  cors({
    origin: APP_ENV.CORS_ORIGINS,
    credentials: true,
  }),
);
app.use(hpp());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 60_000,
    max: IS_PROD ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(morgan(IS_PROD ? "combined" : "dev"));

// --------------------
// Infra singletons (will be used for DI)
// --------------------
let postgres: PgPoolQueryable;
let uowFactory: PgUnitOfWorkFactory;
let cache: RedisRepo;
let maintenanceScheduler: MaintenanceScheduler | undefined;
let httpServer: Server | undefined;
const READINESS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}_timeout_${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

app.get("/healthz", (_req, res) => {
  return res.status(200).json({
    ok: true,
    service: "galactic-api-backend",
    environment: APP_ENV.NODE_ENV,
    at: new Date().toISOString(),
  });
});

app.get("/readyz", async (_req, res) => {
  if (!postgres || !cache) {
    return res.status(503).json({
      ok: false,
      reason: "infra_not_initialized",
    });
  }

  try {
    await Promise.all([
      withTimeout(postgres.ping(), READINESS_TIMEOUT_MS, "db_ping"),
      withTimeout(cache.ping(), READINESS_TIMEOUT_MS, "redis_ping"),
    ]);
    return res.status(200).json({
      ok: true,
      dependencies: { db: "up", redis: "up" },
      at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      reason: error instanceof Error ? error.message : "dependency_unavailable",
    });
  }
});

// --------------------
// Start server & composition root wiring
// --------------------
async function start(): Promise<void> {
  try {
    // --------------------
    // 1️⃣ Initialize infrastructure layer
    // --------------------
    postgres = await PgPoolQueryable.connect(
      {
        connectionString: APP_ENV.DATABASE_URL,
        port: APP_ENV.PGPORT,
        ssl: APP_ENV.PGSSL ? { rejectUnauthorized: false } : false,
        max: APP_ENV.PGMAX,
        idleTimeoutMillis: APP_ENV.PGIDLE_TIMEOUT_MS,
        connectionTimeoutMillis: APP_ENV.PGCONNECTION_TIMEOUT_MS,
        statement_timeout: APP_ENV.PGSTATEMENT_TIMEOUT_MS,
        query_timeout: APP_ENV.PGQUERY_TIMEOUT_MS,
      },
      console,
    );

    uowFactory = new PgUnitOfWorkFactory(postgres._getPool());

    cache = new RedisRepo({
      keyPrefix: APP_ENV.NODE_ENV,
    });
    maintenanceScheduler = new MaintenanceScheduler(postgres);
    await maintenanceScheduler.start();

    // --------------------
    // 2️⃣ Composition root wiring
    // --------------------
    // TODO: Here we will instanciate all that needs DI:
    //! Infra layer (repos)
    const userRepo = new UserRepo(postgres);
    const galaxyRepo = new GalaxyRepo(postgres);
    const systemRepo = new SystemRepo(postgres);
    const starRepo = new StarRepo(postgres);
    const planetRepo = new PlanetRepo(postgres);
    const moonRepo = new MoonRepo(postgres);
    const asteroidRepo = new AsteroidRepo(postgres);
    const logRepo = new LogRepo(postgres);
    const metricRepo = new MetricRepo(postgres);
    const donationRepo = new DonationRepo(postgres);
    const sessionRepo = new SessionRepo(postgres._getPool());
    const securityBanRepo = new SecurityBanRepo(postgres);
    const hasher = new HasherRepo();
    const mailer = new MailerRepo();
    const jwtService = new JwtService();
    const userCache = new UserCacheService(cache);
    const galaxyCache = new GalaxyCacheService(cache);
    const systemCache = new SystemCacheService(cache);
    const starCache = new StarCacheService(cache);
    const planetCache = new PlanetCacheService(cache);
    const moonCache = new MoonCacheService(cache);
    const asteroidCache = new AsteroidCacheService(cache);
    const logCache = new LogCacheService(cache);
    const metricCache = new MetricCacheService(cache);
    const donationCache = new DonationCacheService(cache);
    const securityBanService = new SecurityBanService(
      securityBanRepo,
      userRepo,
      sessionRepo,
      userCache,
      cache,
    );
    const paymentGateway = new PaymentGatewayRepo();
    //! App layer
    // Use-cases
    const healthCheck = new HealthQuery();
    const loginUser = new LoginUser(userRepo, hasher);
    const signupUser = new SignupUser(userRepo, hasher, mailer, userCache);
    const createAdminUser = new CreateAdmin(userRepo, hasher, userCache);
    const verifyUser = new VerifyUser(userRepo, hasher, userCache);
    const resendVerificationCode = new ResendVerificationCode(userRepo, hasher, mailer, userCache);
    const changeEmailUser = new ChangeEmail(userRepo, userCache);
    const changePasswordUser = new ChangePassword(userRepo, hasher, sessionRepo, userCache);
    const changeRoleUser = new ChangeRole(userRepo, sessionRepo, userCache);
    const changeUsernameUser = new ChangeUsername(userRepo, userCache);
    const listUsers = new ListUsers(userRepo, userCache);
    const softDeleteUser = new SoftDeleteUser(userRepo, userCache);
    const restoreUser = new RestoreUser(userRepo, userCache);
    const refreshSession = new RefreshSession(jwtService, sessionRepo, hasher);
    const logoutSession = new LogoutSession(sessionRepo);
    const logoutAllSessions = new LogoutAllSessions(sessionRepo);
    const findUser = new FindUser(userRepo, userCache);
    const galaxyLifecycle = new GalaxyLifecycleService();
    const trackMetric = new TrackMetric(metricRepo, metricCache);
    const findMetric = new FindMetric(metricRepo, metricCache);
    const listMetrics = new ListMetrics(metricRepo, metricCache);
    const metricsDashboard = new MetricsDashboardQuery(metricRepo, metricCache);
    const trafficAnalytics = new TrafficAnalyticsQueryService(metricRepo, metricCache);
    const createDonationCheckout = new CreateDonationCheckout(
      donationRepo,
      paymentGateway,
      donationCache,
    );
    const confirmDonationBySession = new ConfirmDonationBySession(
      donationRepo,
      paymentGateway,
      donationCache,
      userRepo,
      userCache,
    );
    const cancelDonation = new CancelDonation(donationRepo, paymentGateway, donationCache);
    const findDonation = new FindDonation(donationRepo, donationCache);
    const listDonations = new ListDonations(donationRepo, donationCache);
    const getSupporterProgress = new GetSupporterProgress(donationRepo);
    const listSupporterBadges = new ListSupporterBadges(donationRepo);
    const dbMetricTracker = {
      track: async (input: DbMetricInput): Promise<void> => {
        await trackMetric.execute({
          metricName: input.metricName,
          metricType: "db",
          source: input.source,
          durationMs: input.durationMs,
          success: input.success,
          tags: input.tags,
          context: input.context,
        });
      },
    };
    postgres.setMetricTracker(dbMetricTracker);
    uowFactory.setMetricTracker(dbMetricTracker);
    const createGalaxy = new CreateGalaxy(
      uowFactory,
      {
        galaxy: (db) => new GalaxyRepo(db),
        system: (db) => new SystemRepo(db),
        star: (db) => new StarRepo(db),
        planet: (db) => new PlanetRepo(db),
        moon: (db) => new MoonRepo(db),
        asteroid: (db) => new AsteroidRepo(db),
      },
      (db) => new UserRepo(db),
      galaxyLifecycle,
      galaxyCache,
      systemCache,
      trackMetric,
    );
    const changeGalaxyName = new ChangeGalaxyName(galaxyRepo, galaxyCache);
    const changeGalaxyShape = new ChangeGalaxyShape(
      uowFactory,
      {
        galaxy: (db) => new GalaxyRepo(db),
        system: (db) => new SystemRepo(db),
        star: (db) => new StarRepo(db),
        planet: (db) => new PlanetRepo(db),
        moon: (db) => new MoonRepo(db),
        asteroid: (db) => new AsteroidRepo(db),
      },
      galaxyLifecycle,
      galaxyCache,
      systemCache,
      trackMetric,
    );
    const deleteGalaxy = new DeleteGalaxy(
      uowFactory,
      {
        galaxy: (db) => new GalaxyRepo(db),
        system: (db) => new SystemRepo(db),
        star: (db) => new StarRepo(db),
        planet: (db) => new PlanetRepo(db),
        moon: (db) => new MoonRepo(db),
        asteroid: (db) => new AsteroidRepo(db),
      },
      galaxyLifecycle,
      galaxyCache,
      systemCache,
      trackMetric,
    );
    const findGalaxy = new FindGalaxy(galaxyRepo, galaxyCache);
    const listGalaxies = new ListGalaxies(galaxyRepo, galaxyCache);
    const populateGalaxy = new PopulateGalaxy(
      galaxyRepo,
      systemRepo,
      starRepo,
      planetRepo,
      moonRepo,
      asteroidRepo,
      galaxyCache,
    );
    const getGalaxyAggregateCounts = new GetGalaxyAggregateCounts(galaxyRepo);
    const getGlobalProceduralCounts = new GetGlobalProceduralCounts(galaxyRepo);
    const findSystem = new FindSystem(systemRepo, systemCache);
    const listSystemsByGalaxy = new ListSystemsByGalaxy(systemRepo, systemCache);
    const changeSystemName = new ChangeSystemName(systemRepo, systemCache, galaxyCache);
    const changeSystemPosition = new ChangeSystemPosition(systemRepo, systemCache, galaxyCache);
    const findStar = new FindStar(starRepo, starCache);
    const listStarsBySystem = new ListStarsBySystem(starRepo, starCache);
    const changeStarName = new ChangeStarName(starRepo, systemRepo, starCache, galaxyCache);
    const changeStarMain = new ChangeStarMain(starRepo, systemRepo, starCache, galaxyCache);
    const changeStarOrbital = new ChangeStarOrbital(starRepo, systemRepo, starCache, galaxyCache);
    const changeStarStarterOrbital = new ChangeStarStarterOrbital(
      starRepo,
      systemRepo,
      starCache,
      galaxyCache,
    );
    const findPlanet = new FindPlanet(planetRepo, planetCache);
    const listPlanetsBySystem = new ListPlanetsBySystem(planetRepo, planetCache);
    const changePlanetName = new ChangePlanetName(planetRepo, systemRepo, planetCache, galaxyCache);
    const changePlanetOrbital = new ChangePlanetOrbital(
      planetRepo,
      systemRepo,
      planetCache,
      galaxyCache,
    );
    const changePlanetBiome = new ChangePlanetBiome(
      planetRepo,
      systemRepo,
      planetCache,
      galaxyCache,
    );
    const findMoon = new FindMoon(moonRepo, moonCache);
    const listMoonsByPlanet = new ListMoonsByPlanet(moonRepo, moonCache);
    const changeMoonName = new ChangeMoonName(
      moonRepo,
      planetRepo,
      systemRepo,
      moonCache,
      galaxyCache,
    );
    const changeMoonSize = new ChangeMoonSize(
      moonRepo,
      planetRepo,
      systemRepo,
      moonCache,
      galaxyCache,
    );
    const changeMoonOrbital = new ChangeMoonOrbital(
      moonRepo,
      planetRepo,
      systemRepo,
      moonCache,
      galaxyCache,
    );
    const findAsteroid = new FindAsteroid(asteroidRepo, asteroidCache);
    const listAsteroidsBySystem = new ListAsteroidsBySystem(asteroidRepo, asteroidCache);
    const changeAsteroidName = new ChangeAsteroidName(
      asteroidRepo,
      systemRepo,
      asteroidCache,
      galaxyCache,
    );
    const changeAsteroidType = new ChangeAsteroidType(
      asteroidRepo,
      systemRepo,
      asteroidCache,
      galaxyCache,
    );
    const changeAsteroidSize = new ChangeAsteroidSize(
      asteroidRepo,
      systemRepo,
      asteroidCache,
      galaxyCache,
    );
    const changeAsteroidOrbital = new ChangeAsteroidOrbital(
      asteroidRepo,
      systemRepo,
      asteroidCache,
      galaxyCache,
    );
    const createLog = new CreateLog(logRepo, logCache);
    const resolveLog = new ResolveLog(logRepo, logCache);
    const reopenLog = new ReopenLog(logRepo, logCache);
    const setAdminNote = new SetAdminNote(logRepo, logCache);
    const clearAdminNote = new ClearAdminNote(logRepo, logCache);
    const findLog = new FindLog(logRepo, logCache);
    const listLogs = new ListLogs(logRepo, logCache);
    // App-services
    const authService = new AuthService(
      loginUser,
      refreshSession,
      logoutSession,
      logoutAllSessions,
      sessionRepo,
      jwtService,
      hasher,
      userRepo,
      securityBanService,
    );
    const platformService = new PlatformService(
      signupUser,
      createAdminUser,
      verifyUser,
      resendVerificationCode,
      changeEmailUser,
      changePasswordUser,
      changeRoleUser,
      changeUsernameUser,
    );
    const lifecycleService = new LifecycleService(softDeleteUser, restoreUser);
    //! Presentation layer
    // Controllers
    const userController = new UserController(
      healthCheck,
      findUser,
      listUsers,
      authService,
      platformService,
      lifecycleService,
      securityBanService,
      getSupporterProgress,
    );
    const galaxyController = new GalaxyController(
      createGalaxy,
      changeGalaxyName,
      changeGalaxyShape,
      deleteGalaxy,
      findGalaxy,
      listGalaxies,
      populateGalaxy,
      getGalaxyAggregateCounts,
      getGlobalProceduralCounts,
    );
    const systemController = new SystemController(
      findSystem,
      listSystemsByGalaxy,
      changeSystemName,
      changeSystemPosition,
      findGalaxy,
    );
    const starController = new StarController(
      findStar,
      listStarsBySystem,
      changeStarName,
      changeStarMain,
      changeStarOrbital,
      changeStarStarterOrbital,
      findSystem,
      findGalaxy,
    );
    const planetController = new PlanetController(
      findPlanet,
      listPlanetsBySystem,
      changePlanetName,
      changePlanetOrbital,
      changePlanetBiome,
      findSystem,
      findGalaxy,
    );
    const moonController = new MoonController(
      findMoon,
      listMoonsByPlanet,
      changeMoonName,
      changeMoonSize,
      changeMoonOrbital,
      findPlanet,
      findSystem,
      findGalaxy,
    );
    const asteroidController = new AsteroidController(
      findAsteroid,
      listAsteroidsBySystem,
      changeAsteroidName,
      changeAsteroidType,
      changeAsteroidSize,
      changeAsteroidOrbital,
      findSystem,
      findGalaxy,
    );
    const logController = new LogController(
      createLog,
      resolveLog,
      reopenLog,
      setAdminNote,
      clearAdminNote,
      findLog,
      listLogs,
    );
    const metricController = new MetricController(
      trackMetric,
      findMetric,
      listMetrics,
      metricsDashboard,
      trafficAnalytics,
    );
    const donationController = new DonationController(
      createDonationCheckout,
      confirmDonationBySession,
      cancelDonation,
      findDonation,
      listDonations,
      listSupporterBadges,
    );
    // Middlewares
    const authMiddleware = new AuthMiddleware(
      jwtService,
      {
        issuer: APP_ENV.JWT_ISSUER,
        audience: APP_ENV.JWT_AUDIENCE,
      },
      securityBanService,
    );
    const scopeMiddleware = new ScopeMiddleware();
    const requestAuditMiddleware = new RequestAuditMiddleware(createLog, securityBanService);
    const performanceMetricsMiddleware = new PerformanceMetricsMiddleware(trackMetric);
    const securityGuardMiddleware = new SecurityGuardMiddleware(securityBanService);

    app.use(requestAuditMiddleware.bindRequestId());
    app.use(performanceMetricsMiddleware.captureHttpDuration());
    app.use(requestAuditMiddleware.logResponse());
    app.use(securityGuardMiddleware.blockBannedIp());
    // Routers
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
        auth: authMiddleware,
        scope: scopeMiddleware,
      }),
    );

    console.log(
      `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.successColor(
        "✅ Composition root wiring finished",
      )}`,
    );
    app.disable("x-powered-by");

    // --------------------
    // 3️⃣ Start listening
    // --------------------
    httpServer = app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.successColor(
          `Listening on port ${PORT}`,
        )}`,
      );
    });
  } catch (e) {
    console.error(
      `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.errorColor(
        `Failed to start: ${e instanceof Error ? e.message : String(e)}`,
      )}`,
    );
    maintenanceScheduler?.stop();
    try {
      await cache?.close();
    } catch {}
    try {
      await postgres?.close();
    } catch {}
    process.exit(1);
  }
}

// --------------------
// Graceful shutdown
// --------------------
const shutdown = async (signal: string) => {
  console.log(
    `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.warningColor(
      `🛑 Shutdown signal ${signal} received`,
    )}`,
  );
  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((err?: Error) => (err ? reject(err) : resolve()));
      });
    }
    maintenanceScheduler?.stop();
    await cache?.close();
    await postgres?.close();
    process.exit(0);
  } catch (e) {
    console.error(
      `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.errorColor(
        `❌ Shutdown error: ${e instanceof Error ? e.message : String(e)}`,
      )}`,
    );
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    `${CONSOLE_COLORS.labelColor("[ðŸ›œSERVER]")} ${CONSOLE_COLORS.errorColor(
      `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    )}`,
  );
});
process.on("uncaughtException", (error: Error) => {
  console.error(
    `${CONSOLE_COLORS.labelColor("[ðŸ›œSERVER]")} ${CONSOLE_COLORS.errorColor(
      `Uncaught exception: ${error.message}`,
    )}`,
  );
});

// --------------------
// Bootstrap
// --------------------
start().catch((e) => {
  console.error(
    `${CONSOLE_COLORS.labelColor("[🛜SERVER]")} ${CONSOLE_COLORS.errorColor(
      `❌ Bootstrap error: ${e instanceof Error ? e.message : String(e)}`,
    )}`,
  );
  process.exit(1);
});

// --------------------
// Export infra for DI if needed
// --------------------
export { postgres, uowFactory, cache };
