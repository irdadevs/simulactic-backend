import { Pool, PoolClient } from "pg";
import { randomUUID } from "crypto";
import type {
  Queryable,
  QueryResultRow,
  QueryResult,
  QueryParams,
} from "../../config/db/Queryable";
import type { UnitOfWork, UnitOfWorkFactory } from "../../config/db/UnitOfWork";
import type { DbMetricTracker } from "../../config/db/DbMetrics";

class PgClientQueryable implements Queryable {
  constructor(
    private client: PoolClient,
    private readonly metricTracker?: DbMetricTracker,
    private readonly txId?: string,
  ) {}

  async connect(): Promise<void> {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: QueryParams,
  ): Promise<QueryResult<T>> {
    const startedAt = Date.now();
    const operation = inferSqlOperation(sql);
    const shouldTrackMetric = shouldTrackDbMetric(sql);
    try {
      const res = await this.client.query<T>(sql, params);

      const rows = Array.isArray(res.rows) ? res.rows : [];
      if (shouldTrackMetric) {
        void this.metricTracker
          ?.track({
            metricName: "db.query.duration",
            source: "PgUnitOfWork",
            durationMs: Date.now() - startedAt,
            success: true,
            tags: { operation, inTransaction: true },
            context: {
              txId: this.txId,
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
            source: "PgUnitOfWork",
            durationMs: Date.now() - startedAt,
            success: false,
            tags: { operation, inTransaction: true },
            context: {
              txId: this.txId,
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(() => {});
      }
      throw error;
    }
  }

  async ping(): Promise<void> {
    await this.client.query("SELECT 1");
  }

  async close(): Promise<void> {}
}

class PgUnitOfWork implements UnitOfWork {
  readonly db: Queryable;
  private readonly startedAt: number;

  constructor(
    private client: PoolClient,
    private readonly metricTracker?: DbMetricTracker,
    private readonly txId: string = randomUUID(),
  ) {
    this.startedAt = Date.now();
    this.db = new PgClientQueryable(client, metricTracker, txId);
  }

  async commit(): Promise<void> {
    const started = Date.now();
    try {
      await this.client.query("COMMIT");
      void this.metricTracker
        ?.track({
          metricName: "db.transaction.duration",
          source: "PgUnitOfWork",
          durationMs: Date.now() - this.startedAt,
          success: true,
          tags: { operation: "COMMIT" },
          context: { txId: this.txId, commitMs: Date.now() - started },
        })
        .catch(() => {});
    } finally {
      this.client.release();
    }
  }

  async rollback(): Promise<void> {
    const started = Date.now();
    try {
      await this.client.query("ROLLBACK");
      void this.metricTracker
        ?.track({
          metricName: "db.transaction.duration",
          source: "PgUnitOfWork",
          durationMs: Date.now() - this.startedAt,
          success: false,
          tags: { operation: "ROLLBACK" },
          context: { txId: this.txId, rollbackMs: Date.now() - started },
        })
        .catch(() => {});
    } finally {
      this.client.release();
    }
  }
}

export class PgUnitOfWorkFactory implements UnitOfWorkFactory {
  private metricTracker?: DbMetricTracker;

  constructor(pool: Pool, metricTracker?: DbMetricTracker) {
    this.pool = pool;
    this.metricTracker = metricTracker;
  }

  private pool: Pool;

  async start(): Promise<UnitOfWork> {
    const startedAt = Date.now();
    const client = await this.pool.connect();
    const txId = randomUUID();
    try {
      await client.query("BEGIN");
      void this.metricTracker
        ?.track({
          metricName: "db.transaction.begin",
          source: "PgUnitOfWorkFactory",
          durationMs: Date.now() - startedAt,
          success: true,
          tags: { operation: "BEGIN" },
          context: { txId },
        })
        .catch(() => {});
      return new PgUnitOfWork(client, this.metricTracker, txId);
    } catch (e) {
      client.release();
      void this.metricTracker
        ?.track({
          metricName: "db.transaction.begin",
          source: "PgUnitOfWorkFactory",
          durationMs: Date.now() - startedAt,
          success: false,
          tags: { operation: "BEGIN" },
          context: { txId, error: e instanceof Error ? e.message : String(e) },
        })
        .catch(() => {});
      throw e;
    }
  }

  setMetricTracker(metricTracker?: DbMetricTracker): void {
    this.metricTracker = metricTracker;
  }
}

function inferSqlOperation(sql: string): string {
  const normalized = sql.trim().toUpperCase();
  if (!normalized) return "UNKNOWN";
  const firstWord = normalized.split(/\s+/)[0];
  return firstWord || "UNKNOWN";
}

function shouldTrackDbMetric(sql: string): boolean {
  const normalized = sql.toLowerCase();
  if (normalized.includes("metrics.performance_metrics")) return false;
  return true;
}
