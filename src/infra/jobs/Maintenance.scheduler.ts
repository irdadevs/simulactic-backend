import { Queryable } from "../../config/db/Queryable";
import {
  MaintenanceConfig,
  resolveMaintenanceConfig,
} from "../../config/maintenance/Maintenance.config";
import https from "https";

type MaintenanceTask = {
  key: string;
  intervalMs: number;
  run: () => Promise<Record<string, unknown>>;
};

export class MaintenanceScheduler {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly inFlight = new Set<string>();
  private started = false;

  constructor(
    private readonly db: Queryable,
    private readonly config: MaintenanceConfig = resolveMaintenanceConfig(),
    private readonly logger: Pick<Console, "info" | "warn" | "error"> = console,
  ) {}

  async start(): Promise<void> {
    if (!this.config.enabled || this.started) return;

    const tasks: MaintenanceTask[] = [
      {
        key: "maintenance.housekeeping",
        intervalMs: this.config.housekeepingIntervalMs,
        run: async () => this.runHousekeeping(),
      },
      {
        key: "maintenance.users.archive_inactive",
        intervalMs: this.config.usersArchiveIntervalMs,
        run: async () => this.runUsersArchive(),
      },
      {
        key: "maintenance.partition_plan.refresh",
        intervalMs: this.config.partitionPlanIntervalMs,
        run: async () => this.runPartitionPlanRefresh(),
      },
      {
        key: "maintenance.fx_rates.refresh",
        intervalMs: this.config.fxRatesRefreshIntervalMs,
        run: async () => this.runFxRatesRefresh(),
      },
    ];

    for (const task of tasks) {
      this.scheduleTask(task);
    }

    this.started = true;
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers.length = 0;
    this.inFlight.clear();
    this.started = false;
  }

  async runHousekeeping(): Promise<Record<string, unknown>> {
    const result = await this.db.query<{ result: unknown }>(
      `SELECT logs_run_maintenance_housekeeping($1, $2, $3, $4) AS result`,
      [
        this.config.usersArchiveDays,
        this.config.logsArchiveDays,
        this.config.metricsArchiveDays,
        this.config.donationsArchiveDays,
      ],
    );

    return {
      result: result.rows[0]?.result ?? {},
    };
  }

  async runUsersArchive(): Promise<Record<string, unknown>> {
    const result = await this.db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM auth_archive_inactive_users($1)`,
      [this.config.usersArchiveDays],
    );

    return {
      usersArchived: Number(result.rows[0]?.total ?? 0),
      thresholdDays: this.config.usersArchiveDays,
    };
  }

  async runPartitionPlanRefresh(): Promise<Record<string, unknown>> {
    const result = await this.db.query<{ rows_upserted: number }>(
      `SELECT logs_refresh_archive_partition_plan()::bigint AS rows_upserted`,
    );

    return {
      rowsUpserted: Number(result.rows[0]?.rows_upserted ?? 0),
    };
  }

  async runFxRatesRefresh(): Promise<Record<string, unknown>> {
    const payload = await this.fetchEcbRatesXml(this.config.fxRatesSourceUrl);
    const { rateDate, eurBasedRates } = this.parseEcbRates(payload);

    let upserted = 0;

    // EUR baseline.
    await this.db.query(
      `
      INSERT INTO billing.fx_rates_daily (rate_date, currency, rate_to_eur, source, fetched_at)
      VALUES ($1::date, 'EUR', 1, 'ECB', now_utc())
      ON CONFLICT (rate_date, currency) DO UPDATE SET
        rate_to_eur = EXCLUDED.rate_to_eur,
        source = EXCLUDED.source,
        fetched_at = EXCLUDED.fetched_at
      `,
      [rateDate],
    );
    upserted += 1;

    for (const [currency, eurToCurrencyRate] of Object.entries(eurBasedRates)) {
      if (currency === "EUR") continue;
      const rateToEur = 1 / eurToCurrencyRate;
      if (!Number.isFinite(rateToEur) || rateToEur <= 0) continue;

      await this.db.query(
        `
        INSERT INTO billing.fx_rates_daily (rate_date, currency, rate_to_eur, source, fetched_at)
        VALUES ($1::date, $2, $3, 'ECB', now_utc())
        ON CONFLICT (rate_date, currency) DO UPDATE SET
          rate_to_eur = EXCLUDED.rate_to_eur,
          source = EXCLUDED.source,
          fetched_at = EXCLUDED.fetched_at
        `,
        [rateDate, currency, rateToEur],
      );
      upserted += 1;
    }

    return {
      rateDate,
      rowsUpserted: upserted,
    };
  }

  private fetchEcbRatesXml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const statusCode = res.statusCode ?? 500;
        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`FX_SOURCE_HTTP_${statusCode}`));
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => resolve(body));
      });

      req.on("error", (error) => reject(error));
      req.setTimeout(10_000, () => {
        req.destroy(new Error("FX_SOURCE_TIMEOUT"));
      });
    });
  }

  private parseEcbRates(xml: string): {
    rateDate: string;
    eurBasedRates: Record<string, number>;
  } {
    const dateMatch = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/i);
    if (!dateMatch?.[1]) {
      throw new Error("FX_SOURCE_INVALID_DATE");
    }

    const rates: Record<string, number> = {};
    const cubeRegex = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/gi;
    let match: RegExpExecArray | null = cubeRegex.exec(xml);
    while (match) {
      const currency = match[1];
      const rate = Number(match[2]);
      if (currency && Number.isFinite(rate) && rate > 0) {
        rates[currency] = rate;
      }
      match = cubeRegex.exec(xml);
    }

    if (Object.keys(rates).length === 0) {
      throw new Error("FX_SOURCE_EMPTY_RATES");
    }

    return {
      rateDate: dateMatch[1],
      eurBasedRates: rates,
    };
  }

  private scheduleTask(task: MaintenanceTask): void {
    const run = async () => {
      await this.runTask(task);
    };

    if (this.config.runOnStart) {
      void run();
    }

    const timer = setInterval(
      () => {
        void run();
      },
      Math.max(task.intervalMs, 1_000),
    );

    this.timers.push(timer);
  }

  private async runTask(task: MaintenanceTask): Promise<void> {
    if (this.inFlight.has(task.key)) {
      this.logger.warn(`[MAINTENANCE] skip overlapping run for ${task.key}`);
      return;
    }

    this.inFlight.add(task.key);
    const startedAt = new Date();

    try {
      const details = await task.run();
      await this.persistRun(task.key, startedAt, true, details, null);
      this.logger.info(`[MAINTENANCE] ${task.key} completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.persistRun(task.key, startedAt, false, {}, message);
      this.logger.error(`[MAINTENANCE] ${task.key} failed: ${message}`);
    } finally {
      this.inFlight.delete(task.key);
    }
  }

  private async persistRun(
    jobKey: string,
    startedAt: Date,
    success: boolean,
    details: Record<string, unknown>,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO logs.maintenance_job_runs (
          job_key,
          started_at,
          finished_at,
          success,
          details,
          error_message
        )
        VALUES ($1, $2, now_utc(), $3, $4::jsonb, $5)
        `,
        [jobKey, startedAt, success, JSON.stringify(details), errorMessage],
      );
    } catch {
      return;
    }
  }
}
