import { MaintenanceScheduler } from "../../infra/jobs/Maintenance.scheduler";
import { MaintenanceConfig } from "../../config/maintenance/Maintenance.config";
import { QueryResult } from "../../config/db/Queryable";

class FakeDb {
  query = jest.fn(async (sql: string): Promise<QueryResult<any>> => {
    if (sql.includes("logs_run_maintenance_housekeeping")) {
      return { rows: [{ result: { logsArchived: 1 } }], rowCount: 1 };
    }

    if (sql.includes("auth_archive_inactive_users")) {
      return { rows: [{ total: 2 }], rowCount: 1 };
    }

    if (sql.includes("logs_refresh_archive_partition_plan")) {
      return { rows: [{ rows_upserted: 3 }], rowCount: 1 };
    }

    if (sql.includes("billing.fx_rates_daily")) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });

  ping = async (): Promise<void> => undefined;
  close = async (): Promise<void> => undefined;
}

describe("MaintenanceScheduler", () => {
  const config: MaintenanceConfig = {
    enabled: true,
    runOnStart: false,
    usersArchiveDays: 90,
    logsArchiveDays: 30,
    metricsArchiveDays: 30,
    donationsArchiveDays: 365,
    housekeepingIntervalMs: 60_000,
    usersArchiveIntervalMs: 60_000,
    partitionPlanIntervalMs: 60_000,
    fxRatesRefreshIntervalMs: 60_000,
    fxRatesSourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
  };

  it("runs housekeeping SQL function", async () => {
    const db = new FakeDb();
    const scheduler = new MaintenanceScheduler(db as any, config);

    const result = await scheduler.runHousekeeping();
    expect(result.result).toEqual({ logsArchived: 1 });
  });

  it("runs users archive SQL function", async () => {
    const db = new FakeDb();
    const scheduler = new MaintenanceScheduler(db as any, config);

    const result = await scheduler.runUsersArchive();
    expect(result.usersArchived).toBe(2);
  });

  it("runs partition plan refresh SQL function", async () => {
    const db = new FakeDb();
    const scheduler = new MaintenanceScheduler(db as any, config);

    const result = await scheduler.runPartitionPlanRefresh();
    expect(result.rowsUpserted).toBe(3);
  });
});
