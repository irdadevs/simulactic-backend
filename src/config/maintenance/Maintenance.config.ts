export type MaintenanceConfig = {
  enabled: boolean;
  runOnStart: boolean;
  usersArchiveDays: number;
  logsArchiveDays: number;
  metricsArchiveDays: number;
  donationsArchiveDays: number;
  housekeepingIntervalMs: number;
  usersArchiveIntervalMs: number;
  partitionPlanIntervalMs: number;
  fxRatesRefreshIntervalMs: number;
  fxRatesSourceUrl: string;
};

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function intEnv(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

export function resolveMaintenanceConfig(env = process.env): MaintenanceConfig {
  const minute = 60_000;

  return {
    enabled: boolEnv(env.MAINTENANCE_JOBS_ENABLED, true),
    runOnStart: boolEnv(env.MAINTENANCE_RUN_ON_START, true),
    usersArchiveDays: intEnv(env.MAINTENANCE_USERS_ARCHIVE_DAYS, 90, 1),
    logsArchiveDays: intEnv(env.MAINTENANCE_LOGS_ARCHIVE_DAYS, 30, 1),
    metricsArchiveDays: intEnv(env.MAINTENANCE_METRICS_ARCHIVE_DAYS, 30, 1),
    donationsArchiveDays: intEnv(env.MAINTENANCE_DONATIONS_ARCHIVE_DAYS, 365, 1),
    housekeepingIntervalMs: intEnv(env.MAINTENANCE_HOUSEKEEPING_INTERVAL_MIN, 24 * 60, 1) * minute,
    usersArchiveIntervalMs: intEnv(env.MAINTENANCE_USERS_ARCHIVE_INTERVAL_MIN, 6 * 60, 1) * minute,
    partitionPlanIntervalMs:
      intEnv(env.MAINTENANCE_PARTITION_PLAN_INTERVAL_MIN, 12 * 60, 1) * minute,
    fxRatesRefreshIntervalMs:
      intEnv(env.MAINTENANCE_FX_RATES_REFRESH_INTERVAL_MIN, 24 * 60, 1) * minute,
    fxRatesSourceUrl:
      env.MAINTENANCE_FX_RATES_SOURCE_URL?.trim() ||
      "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
  };
}
