import { Pool } from "pg";
import type {
  Queryable,
  QueryParams,
  QueryResult,
  QueryResultRow,
  PgConfig,
} from "../../config/db/Queryable";
import type { DbMetricTracker } from "../../config/db/DbMetrics";
import { ErrorFactory } from "../../utils/errors/Error.map";
import { CONSOLE_COLORS } from "../../utils/Chalk";

export type Logger = {
  info: (...a: any[]) => void;
  warn: (...a: any[]) => void;
  error: (...a: any[]) => void;
};

export class PgPoolQueryable implements Queryable {
  private metricTracker?: DbMetricTracker;

  private constructor(
    private readonly pool: Pool,
    private readonly log?: Logger,
    metricTracker?: DbMetricTracker,
  ) {
    this.metricTracker = metricTracker;
  }

  static async connect(
    cfg: PgConfig,
    log?: Logger,
    maxAttempts = 5,
    metricTracker?: DbMetricTracker,
  ): Promise<PgPoolQueryable> {
    const pool = new Pool(cfg);

    let attempt = 0;
    const start = Date.now();

    while (true) {
      attempt++;
      try {
        const client = await pool.connect();
        try {
          await client.query("SELECT 1");
        } finally {
          client.release();
        }

        log?.info?.(
          `${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.successColor(
            `connected (attempt ${attempt}, ${Date.now() - start}ms at port ${cfg.port}).`,
          )}`,
        );
        break;
      } catch (_err) {
        log?.warn?.(
          `${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.warningColor(
            `connection attempt ${attempt} failed. Retrying...`,
          )}`,
        );

        if (attempt >= maxAttempts) {
          log?.error?.(
            `${CONSOLE_COLORS.labelColor("[# DB]")} ${CONSOLE_COLORS.errorColor(
              `giving up after max attempts`,
            )}`,
          );
          await pool.end().catch(() => {});
          throw ErrorFactory.infra("INFRA.DATABASE_CONNECTION");
        }

        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
        await sleep(backoffMs);
      }
    }

    return new PgPoolQueryable(pool, log, metricTracker);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: QueryParams,
  ): Promise<QueryResult<T>> {
    const startedAt = Date.now();
    const operation = inferSqlOperation(sql);
    const shouldTrackMetric = shouldTrackDbMetric(sql);
    try {
      const res = await this.pool.query<T>(sql as any, params as any);

      const rows = Array.isArray(res.rows) ? (res.rows as T[]) : [];
      if (shouldTrackMetric) {
        void this.metricTracker
          ?.track({
            metricName: "db.query.duration",
            source: "PgPoolQueryable",
            durationMs: Date.now() - startedAt,
            success: true,
            tags: { operation },
            context: {
              rowCount: typeof res.rowCount === "number" ? res.rowCount : rows.length,
            },
          })
          .catch(() => {});
      }

      return {
        rows,
        rowCount: typeof res.rowCount === "number" ? res.rowCount : rows.length,
      };
    } catch (error) {
      if (shouldTrackMetric) {
        void this.metricTracker
          ?.track({
            metricName: "db.query.duration",
            source: "PgPoolQueryable",
            durationMs: Date.now() - startedAt,
            success: false,
            tags: { operation },
            context: {
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(() => {});
      }
      throw error;
    }
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /** internal escape hatch for UoW factory */
  _getPool(): Pool {
    return this.pool;
  }

  setMetricTracker(metricTracker?: DbMetricTracker): void {
    this.metricTracker = metricTracker;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function inferSqlOperation(sql: string): string {
  const normalized = sql.trim().toUpperCase();
  if (!normalized) return "UNKNOWN";
  const firstWord = normalized.split(/\s+/)[0];
  return firstWord || "UNKNOWN";
}

function shouldTrackDbMetric(sql: string): boolean {
  const normalized = sql.toLowerCase();
  // Avoid recursive metric writes when metric tracking itself persists DB metrics.
  if (normalized.includes("metrics.performance_metrics")) return false;
  return true;
}
