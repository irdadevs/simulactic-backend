import { resolveMaintenanceConfig } from "../../config/maintenance/Maintenance.config";

describe("resolveMaintenanceConfig", () => {
  it("returns defaults when env is empty", () => {
    const cfg = resolveMaintenanceConfig({} as NodeJS.ProcessEnv);

    expect(cfg.enabled).toBe(true);
    expect(cfg.runOnStart).toBe(true);
    expect(cfg.usersArchiveDays).toBe(90);
    expect(cfg.logsArchiveDays).toBe(30);
    expect(cfg.metricsArchiveDays).toBe(30);
    expect(cfg.donationsArchiveDays).toBe(365);
  });

  it("applies env overrides", () => {
    const cfg = resolveMaintenanceConfig({
      MAINTENANCE_JOBS_ENABLED: "false",
      MAINTENANCE_RUN_ON_START: "false",
      MAINTENANCE_USERS_ARCHIVE_DAYS: "120",
      MAINTENANCE_LOGS_ARCHIVE_DAYS: "45",
      MAINTENANCE_METRICS_ARCHIVE_DAYS: "60",
      MAINTENANCE_DONATIONS_ARCHIVE_DAYS: "730",
      MAINTENANCE_HOUSEKEEPING_INTERVAL_MIN: "10",
      MAINTENANCE_USERS_ARCHIVE_INTERVAL_MIN: "20",
      MAINTENANCE_PARTITION_PLAN_INTERVAL_MIN: "30",
      MAINTENANCE_FX_RATES_REFRESH_INTERVAL_MIN: "1440",
      MAINTENANCE_FX_RATES_SOURCE_URL: "https://example.local/fx.xml",
    } as NodeJS.ProcessEnv);

    expect(cfg.enabled).toBe(false);
    expect(cfg.runOnStart).toBe(false);
    expect(cfg.usersArchiveDays).toBe(120);
    expect(cfg.logsArchiveDays).toBe(45);
    expect(cfg.metricsArchiveDays).toBe(60);
    expect(cfg.donationsArchiveDays).toBe(730);
    expect(cfg.housekeepingIntervalMs).toBe(10 * 60_000);
    expect(cfg.usersArchiveIntervalMs).toBe(20 * 60_000);
    expect(cfg.partitionPlanIntervalMs).toBe(30 * 60_000);
    expect(cfg.fxRatesRefreshIntervalMs).toBe(1440 * 60_000);
    expect(cfg.fxRatesSourceUrl).toBe("https://example.local/fx.xml");
  });
});
