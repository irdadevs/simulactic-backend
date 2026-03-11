import Express, { Express as ExpressApp } from "express";
import { buildApiRouter } from "../../presentation/routes";
import { AuthMiddleware } from "../../presentation/middlewares/Auth.middleware";
import { ScopeMiddleware } from "../../presentation/middlewares/Scope.middleware.ts";
import { RequestAuditMiddleware } from "../../presentation/middlewares/RequestAudit.middleware";
import { PerformanceMetricsMiddleware } from "../../presentation/middlewares/PerformanceMetrics.middleware";
import { SecurityGuardMiddleware } from "../../presentation/middlewares/SecurityGuard.middleware";
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
import UserRepo from "../../infra/repos/User.repository";
import GalaxyRepo from "../../infra/repos/Galaxy.repository";
import SystemRepo from "../../infra/repos/System.repository";
import StarRepo from "../../infra/repos/Star.repository";
import PlanetRepo from "../../infra/repos/Planet.repository";
import MoonRepo from "../../infra/repos/Moon.repository";
import AsteroidRepo from "../../infra/repos/Asteroid.repository";
import LogRepo from "../../infra/repos/Log.repository";
import MetricRepo from "../../infra/repos/Metric.repository";
import DonationRepo from "../../infra/repos/Donation.repository";
import { SessionRepo } from "../../infra/repos/Session.repository";
import { SecurityBanRepo } from "../../infra/repos/SecurityBan.repository";
import { HasherRepo } from "../../infra/repos/Hasher.repository";
import JwtService from "../../infra/repos/Jwt.repository";
import { HealthQuery } from "../../app/use-cases/queries/Health.query";
import FindUser from "../../app/use-cases/queries/users/FindUser.query";
import { ListUsers } from "../../app/use-cases/queries/users/ListUsers.query";
import { LoginUser } from "../../app/use-cases/commands/users/LoginUser.command";
import { SignupUser } from "../../app/use-cases/commands/users/SignupUser.command";
import { CreateAdmin } from "../../app/use-cases/commands/users/CreateAdmin.command";
import { ResetPassword } from "../../app/use-cases/commands/users/ResetPassword.command";
import { VerifyUser } from "../../app/use-cases/commands/users/VerifyUser.command";
import { ResendVerificationCode } from "../../app/use-cases/commands/users/ResendVerificationCode.command";
import { ChangeEmail } from "../../app/use-cases/commands/users/ChangeEmail.command";
import { ChangePassword } from "../../app/use-cases/commands/users/ChangePassword.command";
import { ChangeRole } from "../../app/use-cases/commands/users/ChangeRole.command";
import { ChangeUsername } from "../../app/use-cases/commands/users/ChangeUsername.command";
import { SoftDeleteUser } from "../../app/use-cases/commands/users/SoftDeleteUser.command";
import { RestoreUser } from "../../app/use-cases/commands/users/RestoreUser.command";
import { RefreshSession } from "../../app/use-cases/commands/users/RefreshSession.command";
import { LogoutSession } from "../../app/use-cases/commands/users/LogoutSession.command";
import { LogoutAllSessions } from "../../app/use-cases/commands/users/LogoutAllSessions.command";
import { AuthService } from "../../app/app-services/users/Auth.service";
import { SecurityBanService } from "../../app/app-services/security/SecurityBan.service";
import { PlatformService } from "../../app/app-services/users/Platform.service";
import { LifecycleService } from "../../app/app-services/users/Lifecycle.service";
import { UserCacheService } from "../../app/app-services/users/UserCache.service";
import { GalaxyCacheService } from "../../app/app-services/galaxies/GalaxyCache.service";
import { SystemCacheService } from "../../app/app-services/systems/SystemCache.service";
import { StarCacheService } from "../../app/app-services/stars/StarCache.service";
import { PlanetCacheService } from "../../app/app-services/planets/PlanetCache.service";
import { MoonCacheService } from "../../app/app-services/moons/MoonCache.service";
import { AsteroidCacheService } from "../../app/app-services/asteroids/AsteroidCache.service";
import { LogCacheService } from "../../app/app-services/logs/LogCache.service";
import { MetricCacheService } from "../../app/app-services/metrics/MetricCache.service";
import { DonationCacheService } from "../../app/app-services/donations/DonationCache.service";
import { CreateGalaxy } from "../../app/use-cases/commands/galaxies/CreateGalaxy.command";
import { ChangeGalaxyName } from "../../app/use-cases/commands/galaxies/ChangeGalaxyName.command";
import { ChangeGalaxyShape } from "../../app/use-cases/commands/galaxies/ChangeGalaxyShape.command";
import { DeleteGalaxy } from "../../app/use-cases/commands/galaxies/DeleteGalaxy.command";
import { FindGalaxy } from "../../app/use-cases/queries/galaxies/FindGalaxy.query";
import { ListGalaxies } from "../../app/use-cases/queries/galaxies/ListGalaxies.query";
import { PopulateGalaxy } from "../../app/use-cases/queries/galaxies/PopulateGalaxy.query";
import { GetGalaxyAggregateCounts } from "../../app/use-cases/queries/galaxies/GetGalaxyAggregateCounts.query";
import { GetGlobalProceduralCounts } from "../../app/use-cases/queries/galaxies/GetGlobalProceduralCounts.query";
import { GalaxyLifecycleService } from "../../app/app-services/galaxies/GalaxyLifecycle.service";
import { FindSystem } from "../../app/use-cases/queries/systems/FindSystem.query";
import { ListSystemsByGalaxy } from "../../app/use-cases/queries/systems/ListSystemsByGalaxy.query";
import { ChangeSystemName } from "../../app/use-cases/commands/systems/ChangeSystemName.command";
import { ChangeSystemPosition } from "../../app/use-cases/commands/systems/ChangeSystemPosition.command";
import { FindStar } from "../../app/use-cases/queries/stars/FindStar.query";
import { ListStarsBySystem } from "../../app/use-cases/queries/stars/ListStarsBySystem.query";
import { ChangeStarName } from "../../app/use-cases/commands/stars/ChangeStarName.command";
import { ChangeStarMain } from "../../app/use-cases/commands/stars/ChangeStarMain.command";
import { ChangeStarOrbital } from "../../app/use-cases/commands/stars/ChangeStarOrbital.command";
import { ChangeStarStarterOrbital } from "../../app/use-cases/commands/stars/ChangeStarStarterOrbital.command";
import { FindPlanet } from "../../app/use-cases/queries/planets/FindPlanet.query";
import { ListPlanetsBySystem } from "../../app/use-cases/queries/planets/ListPlanetsBySystem.query";
import { ChangePlanetName } from "../../app/use-cases/commands/planets/ChangePlanetName.command";
import { ChangePlanetOrbital } from "../../app/use-cases/commands/planets/ChangePlanetOrbital.command";
import { ChangePlanetBiome } from "../../app/use-cases/commands/planets/ChangePlanetBiome.command";
import { FindMoon } from "../../app/use-cases/queries/moons/FindMoon.query";
import { ListMoonsByPlanet } from "../../app/use-cases/queries/moons/ListMoonsByPlanet.query";
import { ChangeMoonName } from "../../app/use-cases/commands/moons/ChangeMoonName.command";
import { ChangeMoonSize } from "../../app/use-cases/commands/moons/ChangeMoonSize.command";
import { ChangeMoonOrbital } from "../../app/use-cases/commands/moons/ChangeMoonOrbital.command";
import { FindAsteroid } from "../../app/use-cases/queries/asteroids/FindAsteroid.query";
import { ListAsteroidsBySystem } from "../../app/use-cases/queries/asteroids/ListAsteroidsBySystem.query";
import { ChangeAsteroidName } from "../../app/use-cases/commands/asteroids/ChangeAsteroidName.command";
import { ChangeAsteroidType } from "../../app/use-cases/commands/asteroids/ChangeAsteroidType.command";
import { ChangeAsteroidSize } from "../../app/use-cases/commands/asteroids/ChangeAsteroidSize.command";
import { ChangeAsteroidOrbital } from "../../app/use-cases/commands/asteroids/ChangeAsteroidOrbital.command";
import { CreateLog } from "../../app/use-cases/commands/logs/CreateLog.command";
import { ClearAdminNote } from "../../app/use-cases/commands/logs/ClearAdminNote.command";
import { ReopenLog } from "../../app/use-cases/commands/logs/ReopenLog.command";
import { ResolveLog } from "../../app/use-cases/commands/logs/ResolveLog.command";
import { SetAdminNote } from "../../app/use-cases/commands/logs/SetAdminNote.command";
import { FindLog } from "../../app/use-cases/queries/logs/FindLog.query";
import { ListLogs } from "../../app/use-cases/queries/logs/ListLogs.query";
import { TrackMetric } from "../../app/use-cases/commands/metrics/TrackMetric.command";
import { FindMetric } from "../../app/use-cases/queries/metrics/FindMetric.query";
import { ListMetrics } from "../../app/use-cases/queries/metrics/ListMetrics.query";
import { MetricsDashboardQuery } from "../../app/use-cases/queries/metrics/MetricsDashboard.query";
import { TrafficAnalyticsQueryService } from "../../app/use-cases/queries/metrics/TrafficAnalytics.query";
import { CreateDonationCheckout } from "../../app/use-cases/commands/donations/CreateDonationCheckout.command";
import { ConfirmDonationBySession } from "../../app/use-cases/commands/donations/ConfirmDonationBySession.command";
import { CancelDonation } from "../../app/use-cases/commands/donations/CancelDonation.command";
import { FindDonation } from "../../app/use-cases/queries/donations/FindDonation.query";
import { ListDonations } from "../../app/use-cases/queries/donations/ListDonations.query";
import { GetSupporterProgress } from "../../app/use-cases/queries/donations/GetSupporterProgress.query";
import { ListSupporterBadges } from "../../app/use-cases/queries/donations/ListSupporterBadges.query";
import { Email, User } from "../../domain/aggregates/User";
import { RealInfraContext } from "./realInfra";
import { IMailer } from "../../app/interfaces/Mailer.port";
import {
  IPaymentGateway,
  RetrievedCheckoutSession,
} from "../../app/interfaces/PaymentGateway.port";

type SeedUserInput = {
  email: string;
  username: string;
  password: string;
  role?: "User" | "Admin";
  isVerified?: boolean;
  isSupporter?: boolean;
};

class FakePaymentGateway implements IPaymentGateway {
  private sessions = new Map<string, RetrievedCheckoutSession>();
  private seq = 0;

  async createCheckoutSession(): Promise<{ sessionId: string; url: string }> {
    this.seq += 1;
    const sessionId = `cs_test_${this.seq}`;
    this.sessions.set(sessionId, {
      sessionId,
      status: "complete",
      paymentStatus: "paid",
      customerId: "cus_test",
      subscriptionId: `sub_test_${this.seq}`,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return { sessionId, url: `https://checkout.test/${sessionId}` };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<RetrievedCheckoutSession> {
    return (
      this.sessions.get(sessionId) ?? {
        sessionId,
        status: "expired",
        paymentStatus: "unpaid",
        customerId: null,
        subscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }
    );
  }

  async cancelSubscription(): Promise<void> {}
}

export type RealApiApp = {
  app: ExpressApp;
  seedUser: (input: SeedUserInput) => Promise<{ id: string; email: string; username: string }>;
  getLatestMail: (email: string) => { subject: string; body: string } | null;
};

class CapturingMailer implements IMailer {
  private readonly sent = new Map<string, Array<{ subject: string; body: string }>>();

  genCode(long = 8): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < long; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async send(to: Email, subject: string, body: string): Promise<void> {
    const key = to.toString();
    const messages = this.sent.get(key) ?? [];
    messages.push({ subject, body });
    this.sent.set(key, messages);
  }

  getLatest(email: string): { subject: string; body: string } | null {
    const messages = this.sent.get(email.trim().toLowerCase()) ?? [];
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }
}

export function buildRealApiApp(ctx: RealInfraContext): RealApiApp {
  const userRepo = new UserRepo(ctx.db);
  const galaxyRepo = new GalaxyRepo(ctx.db);
  const systemRepo = new SystemRepo(ctx.db);
  const starRepo = new StarRepo(ctx.db);
  const planetRepo = new PlanetRepo(ctx.db);
  const moonRepo = new MoonRepo(ctx.db);
  const asteroidRepo = new AsteroidRepo(ctx.db);
  const logRepo = new LogRepo(ctx.db);
  const metricRepo = new MetricRepo(ctx.db);
  const donationRepo = new DonationRepo(ctx.db);
  const sessionRepo = new SessionRepo(ctx.db._getPool());
  const securityBanRepo = new SecurityBanRepo(ctx.db);
  const hasher = new HasherRepo();
  const mailer = new CapturingMailer();
  const jwtService = new JwtService();
  const userCache = new UserCacheService(ctx.cache);
  const galaxyCache = new GalaxyCacheService(ctx.cache);
  const systemCache = new SystemCacheService(ctx.cache);
  const starCache = new StarCacheService(ctx.cache);
  const planetCache = new PlanetCacheService(ctx.cache);
  const moonCache = new MoonCacheService(ctx.cache);
  const asteroidCache = new AsteroidCacheService(ctx.cache);
  const logCache = new LogCacheService(ctx.cache);
  const metricCache = new MetricCacheService(ctx.cache);
  const donationCache = new DonationCacheService(ctx.cache);
  const securityBanService = new SecurityBanService(
    securityBanRepo,
    userRepo,
    sessionRepo,
    userCache,
    ctx.cache,
  );
  const paymentGateway = new FakePaymentGateway();

  const healthCheck = new HealthQuery();
  const loginUser = new LoginUser(userRepo, hasher);
  const signupUser = new SignupUser(userRepo, hasher, mailer, userCache);
  const createAdminUser = new CreateAdmin(userRepo, hasher, userCache);
  const resetPasswordUser = new ResetPassword(userRepo, hasher, mailer, sessionRepo, userCache);
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

  const createGalaxy = new CreateGalaxy(
    ctx.uowFactory,
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
    ctx.uowFactory,
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
    ctx.uowFactory,
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
  const changePlanetBiome = new ChangePlanetBiome(planetRepo, systemRepo, planetCache, galaxyCache);
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
    resetPasswordUser,
    verifyUser,
    resendVerificationCode,
    changeEmailUser,
    changePasswordUser,
    changeRoleUser,
    changeUsernameUser,
  );
  const lifecycleService = new LifecycleService(softDeleteUser, restoreUser);

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

  const authMiddleware = new AuthMiddleware(
    jwtService,
    {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    },
    securityBanService,
  );
  const scopeMiddleware = new ScopeMiddleware();
  const requestAuditMiddleware = new RequestAuditMiddleware(createLog, securityBanService);
  const performanceMetricsMiddleware = new PerformanceMetricsMiddleware(trackMetric);
  const securityGuardMiddleware = new SecurityGuardMiddleware(securityBanService);

  const app = Express();
  app.use(Express.json());
  app.use(requestAuditMiddleware.bindRequestId());
  app.use(performanceMetricsMiddleware.captureHttpDuration());
  app.use(requestAuditMiddleware.logResponse());
  app.use(securityGuardMiddleware.blockBannedIp());
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

  const seedUser = async (input: SeedUserInput) => {
    const passwordHash = await hasher.hash(input.password);
    const user = User.create({
      email: input.email,
      username: input.username,
      passwordHash,
      role: input.role ?? "User",
      isVerified: input.isVerified ?? true,
      verifiedAt: input.isVerified === false ? null : new Date(),
      isSupporter: input.isSupporter ?? false,
      supporterFrom: input.isSupporter ? new Date() : null,
    });

    const saved = await userRepo.save(user);
    return { id: saved.id, email: saved.email, username: saved.username };
  };

  return {
    app,
    seedUser,
    getLatestMail: (email: string) => mailer.getLatest(email),
  };
}
