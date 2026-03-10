import {
  DashboardQuery,
  IMetric,
  ListMetricsQuery,
  MetricsDashboard,
  TrafficAnalyticsQuery,
  TrafficPageViewRecord,
} from "../../app/interfaces/Metric.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";
import { Metric } from "../../domain/aggregates/Metric";
import { paginateFrom, ParamBag } from "../../utils/Pagination";
import { ErrorFactory } from "../../utils/errors/Error.map";

export default class MetricRepo implements IMetric {
  constructor(private readonly db: Queryable) {}

  private mapRow(row: QueryResultRow): Metric {
    return Metric.rehydrate({
      id: String(row.id),
      metricName: row.metric_name,
      metricType: row.metric_type,
      source: row.source,
      durationMs: Number(row.duration_ms),
      success: Boolean(row.success),
      userId: row.user_id ?? null,
      requestId: row.request_id ?? null,
      tags: row.tags ?? {},
      context: row.context ?? {},
      occurredAt: new Date(row.occurred_at),
    });
  }

  async save(metric: Metric): Promise<Metric> {
    const json = metric.toJSON();
    const insert = await this.db.query<{ id: string }>(
      `
      INSERT INTO metrics.performance_metrics (
        metric_name, metric_type, source, duration_ms, success,
        user_id, request_id, tags, context, occurred_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
      RETURNING id
      `,
      [
        json.metricName,
        json.metricType,
        json.source,
        json.durationMs,
        json.success,
        json.userId,
        json.requestId,
        JSON.stringify(json.tags ?? {}),
        JSON.stringify(json.context ?? {}),
        json.occurredAt,
      ],
    );

    const id = String(insert.rows[0]?.id ?? "");
    const stored = await this.findById(id);
    if (!stored) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "metric", id });
    }
    return stored;
  }

  async findById(id: string): Promise<Metric | null> {
    const query = await this.db.query(
      `
      SELECT
        id, metric_name, metric_type, source, duration_ms, success, user_id,
        request_id, tags, context, occurred_at
      FROM metrics.performance_metrics
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async list(query: ListMetricsQuery): Promise<{ rows: Metric[]; total: number }> {
    const params = new ParamBag();
    const where: string[] = [];

    if (query.metricType) where.push(`metric_type = ${params.add(query.metricType)}`);
    if (query.metricName?.trim()) where.push(`metric_name = ${params.add(query.metricName.trim())}`);
    if (query.source?.trim()) where.push(`source = ${params.add(query.source.trim())}`);
    if (query.requestId?.trim()) where.push(`request_id = ${params.add(query.requestId.trim())}`);
    if (query.userId?.trim()) where.push(`user_id = ${params.add(query.userId.trim())}`);
    if (typeof query.success === "boolean") where.push(`success = ${params.add(query.success)}`);
    if (query.minDurationMs != null) where.push(`duration_ms >= ${params.add(query.minDurationMs)}`);
    if (query.maxDurationMs != null) where.push(`duration_ms <= ${params.add(query.maxDurationMs)}`);
    if (query.from) where.push(`occurred_at >= ${params.add(query.from)}`);
    if (query.to) where.push(`occurred_at <= ${params.add(query.to)}`);

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const fromSql = `
      FROM metrics.performance_metrics
      ${whereSql}
      ${where.length > 0 ? "AND" : "WHERE"} is_archived = false
    `;

    const page = await paginateFrom<QueryResultRow>(this.db, fromSql, params.values, {
      select: `
        id, metric_name, metric_type, source, duration_ms, success, user_id,
        request_id, tags, context, occurred_at
      `,
      orderMap: {
        occurredAt: "occurred_at",
        durationMs: "duration_ms",
        metricName: "metric_name",
      },
      orderBy: query.orderBy ?? "occurredAt",
      orderDir: query.orderDir ?? "desc",
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    return { rows: page.rows.map((row) => this.mapRow(row)), total: page.total };
  }

  async dashboard(query: DashboardQuery): Promise<MetricsDashboard> {
    const hours = Math.min(24 * 30, Math.max(1, query.hours ?? 24));
    const topLimit = Math.min(50, Math.max(1, query.topLimit ?? 10));

    const window = await this.db.query<{ from_at: Date; to_at: Date }>(
      `SELECT now_utc() - make_interval(hours => $1::int) AS from_at, now_utc() AS to_at`,
      [hours],
    );
    const from = new Date(window.rows[0].from_at);
    const to = new Date(window.rows[0].to_at);

    const summaryRes = await this.db.query<{
      total: number;
      avg_duration_ms: number;
      p95_duration_ms: number;
      p99_duration_ms: number;
      max_duration_ms: number;
      error_rate: number;
    }>(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(duration_ms), 0)::float8 AS avg_duration_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS p95_duration_ms,
        COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS p99_duration_ms,
        COALESCE(MAX(duration_ms), 0)::float8 AS max_duration_ms,
        COALESCE(AVG(CASE WHEN success THEN 0 ELSE 1 END), 0)::float8 AS error_rate
      FROM metrics.performance_metrics
      WHERE occurred_at >= $1 AND occurred_at <= $2 AND is_archived = false
      `,
      [from, to],
    );

    const byTypeRes = await this.db.query<{
      metric_type: string;
      total: number;
      avg_duration_ms: number;
      p95_duration_ms: number;
      error_rate: number;
    }>(
      `
      SELECT
        metric_type,
        COUNT(*)::int AS total,
        COALESCE(AVG(duration_ms), 0)::float8 AS avg_duration_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS p95_duration_ms,
        COALESCE(AVG(CASE WHEN success THEN 0 ELSE 1 END), 0)::float8 AS error_rate
      FROM metrics.performance_metrics
      WHERE occurred_at >= $1 AND occurred_at <= $2 AND is_archived = false
      GROUP BY metric_type
      ORDER BY avg_duration_ms DESC
      `,
      [from, to],
    );

    const bottlenecksRes = await this.db.query<{
      metric_name: string;
      metric_type: string;
      source: string;
      total: number;
      avg_duration_ms: number;
      p95_duration_ms: number;
      max_duration_ms: number;
      error_rate: number;
    }>(
      `
      SELECT
        metric_name,
        metric_type,
        source,
        COUNT(*)::int AS total,
        COALESCE(AVG(duration_ms), 0)::float8 AS avg_duration_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS p95_duration_ms,
        COALESCE(MAX(duration_ms), 0)::float8 AS max_duration_ms,
        COALESCE(AVG(CASE WHEN success THEN 0 ELSE 1 END), 0)::float8 AS error_rate
      FROM metrics.performance_metrics
      WHERE occurred_at >= $1 AND occurred_at <= $2 AND is_archived = false
      GROUP BY metric_name, metric_type, source
      HAVING COUNT(*) >= 2
      ORDER BY p95_duration_ms DESC, avg_duration_ms DESC
      LIMIT $3
      `,
      [from, to, topLimit],
    );

    const failuresRes = await this.db.query<{
      id: string;
      metric_name: string;
      metric_type: string;
      source: string;
      duration_ms: number;
      occurred_at: Date;
      context: Record<string, unknown>;
    }>(
      `
      SELECT id, metric_name, metric_type, source, duration_ms, occurred_at, context
      FROM metrics.performance_metrics
      WHERE occurred_at >= $1 AND occurred_at <= $2 AND success = false AND is_archived = false
      ORDER BY occurred_at DESC
      LIMIT 20
      `,
      [from, to],
    );

    const summary = summaryRes.rows[0] ?? {
      total: 0,
      avg_duration_ms: 0,
      p95_duration_ms: 0,
      p99_duration_ms: 0,
      max_duration_ms: 0,
      error_rate: 0,
    };

    return {
      from,
      to,
      summary: {
        total: Number(summary.total ?? 0),
        avgDurationMs: Number(summary.avg_duration_ms ?? 0),
        p95DurationMs: Number(summary.p95_duration_ms ?? 0),
        p99DurationMs: Number(summary.p99_duration_ms ?? 0),
        maxDurationMs: Number(summary.max_duration_ms ?? 0),
        errorRate: Number(summary.error_rate ?? 0),
      },
      byType: byTypeRes.rows.map((row) => ({
        metricType: row.metric_type as any,
        total: Number(row.total ?? 0),
        avgDurationMs: Number(row.avg_duration_ms ?? 0),
        p95DurationMs: Number(row.p95_duration_ms ?? 0),
        errorRate: Number(row.error_rate ?? 0),
      })),
      topBottlenecks: bottlenecksRes.rows.map((row) => ({
        metricName: row.metric_name,
        metricType: row.metric_type as any,
        source: row.source,
        total: Number(row.total ?? 0),
        avgDurationMs: Number(row.avg_duration_ms ?? 0),
        p95DurationMs: Number(row.p95_duration_ms ?? 0),
        maxDurationMs: Number(row.max_duration_ms ?? 0),
        errorRate: Number(row.error_rate ?? 0),
      })),
      recentFailures: failuresRes.rows.map((row) => ({
        id: String(row.id),
        metricName: row.metric_name,
        metricType: row.metric_type as any,
        source: row.source,
        durationMs: Number(row.duration_ms),
        occurredAt: new Date(row.occurred_at),
        context: row.context ?? {},
      })),
    };
  }

  async listTrafficPageViews(query: TrafficAnalyticsQuery): Promise<TrafficPageViewRecord[]> {
    const result = await this.db.query<{
      id: string;
      duration_ms: number;
      occurred_at: Date;
      tags: Record<string, unknown>;
      context: Record<string, unknown>;
    }>(
      `
      SELECT
        id,
        duration_ms,
        occurred_at,
        tags,
        context
      FROM metrics.performance_metrics
      WHERE metric_name = 'traffic.page_view'
        AND occurred_at >= $1
        AND occurred_at <= $2
        AND is_archived = false
      ORDER BY occurred_at DESC
      `,
      [query.from, query.to],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      durationMs: Number(row.duration_ms),
      occurredAt: new Date(row.occurred_at),
      tags: row.tags ?? {},
      context: row.context ?? {},
    }));
  }
}
