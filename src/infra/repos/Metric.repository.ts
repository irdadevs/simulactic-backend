import {
  DashboardQuery,
  IMetric,
  ListMetricsQuery,
  MetricsDashboard,
  TrafficAnalyticsQuery,
  TrafficAnalytics,
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

  async trafficAnalytics(query: TrafficAnalyticsQuery): Promise<TrafficAnalytics> {
    const limits = {
      recent: Math.min(200, Math.max(1, query.limitRecent ?? 20)),
      routes: Math.min(200, Math.max(1, query.limitRoutes ?? 20)),
      referrers: Math.min(200, Math.max(1, query.limitReferrers ?? 20)),
    };

    const overviewRes = await this.db.query<{
      page_views: number;
      unique_sessions: number;
      tracked_routes: number;
      external_referrals: number;
    }>(
      `
      WITH base AS (
        SELECT
          duration_ms,
          tags,
          context,
          COALESCE(
            NULLIF(context->>'pathname', ''),
            NULLIF(context->>'fullPath', ''),
            NULLIF(tags->>'pathname', ''),
            'unknown'
          ) AS normalized_path,
          NULLIF(context->>'sessionId', '') AS session_id
        FROM metrics.performance_metrics
        WHERE metric_name = 'traffic.page_view'
          AND occurred_at >= $1
          AND occurred_at <= $2
          AND is_archived = false
      )
      SELECT
        COUNT(*)::int AS page_views,
        COUNT(DISTINCT session_id)::int AS unique_sessions,
        COUNT(DISTINCT normalized_path)::int AS tracked_routes,
        COUNT(*) FILTER (WHERE tags->>'externalReferrer' = 'true')::int AS external_referrals
      FROM base
      `,
      [query.from, query.to],
    );

    const viewsByDayRes = await this.db.query<{
      date: string;
      views: number;
    }>(
      `
      WITH days AS (
        SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
      ),
      counts AS (
        SELECT
          occurred_at::date AS day,
          COUNT(*)::int AS views
        FROM metrics.performance_metrics
        WHERE metric_name = 'traffic.page_view'
          AND occurred_at >= $1
          AND occurred_at <= $2
          AND is_archived = false
        GROUP BY occurred_at::date
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS date,
        COALESCE(counts.views, 0)::int AS views
      FROM days
      LEFT JOIN counts ON counts.day = days.day
      ORDER BY days.day ASC
      `,
      [query.from, query.to],
    );

    const routesRes = await this.db.query<{
      path: string;
      views: number;
      unique_sessions: number;
      avg_duration_ms: number;
    }>(
      `
      WITH base AS (
        SELECT
          duration_ms,
          COALESCE(
            NULLIF(context->>'pathname', ''),
            NULLIF(context->>'fullPath', ''),
            NULLIF(tags->>'pathname', ''),
            'unknown'
          ) AS path,
          NULLIF(context->>'sessionId', '') AS session_id
        FROM metrics.performance_metrics
        WHERE metric_name = 'traffic.page_view'
          AND occurred_at >= $1
          AND occurred_at <= $2
          AND is_archived = false
      )
      SELECT
        path,
        COUNT(*)::int AS views,
        COUNT(DISTINCT session_id)::int AS unique_sessions,
        COALESCE(AVG(duration_ms), 0)::float8 AS avg_duration_ms
      FROM base
      GROUP BY path
      ORDER BY views DESC, path ASC
      LIMIT $3
      `,
      [query.from, query.to, limits.routes],
    );

    const referrersRes = await this.db.query<{
      referrer: string;
      views: number;
    }>(
      `
      WITH base AS (
        SELECT
          COALESCE(
            NULLIF(context->>'referrerHost', ''),
            NULLIF(tags->>'referrerHost', '')
          ) AS referrer
        FROM metrics.performance_metrics
        WHERE metric_name = 'traffic.page_view'
          AND occurred_at >= $1
          AND occurred_at <= $2
          AND is_archived = false
      )
      SELECT
        referrer,
        COUNT(*)::int AS views
      FROM base
      WHERE referrer IS NOT NULL
      GROUP BY referrer
      ORDER BY views DESC, referrer ASC
      LIMIT $3
      `,
      [query.from, query.to, limits.referrers],
    );

    const recentViewsRes = await this.db.query<{
      id: string;
      occurred_at: Date;
      path: string | null;
      full_path: string | null;
      referrer_host: string | null;
      session_id: string | null;
      viewport: Record<string, unknown> | null;
      duration_ms: number;
    }>(
      `
      SELECT
        id,
        occurred_at,
        NULLIF(context->>'pathname', '') AS path,
        NULLIF(context->>'fullPath', '') AS full_path,
        COALESCE(
          NULLIF(context->>'referrerHost', ''),
          NULLIF(tags->>'referrerHost', '')
        ) AS referrer_host,
        NULLIF(context->>'sessionId', '') AS session_id,
        CASE
          WHEN jsonb_typeof(context->'viewport') = 'object' THEN context->'viewport'
          ELSE NULL
        END AS viewport,
        duration_ms
      FROM metrics.performance_metrics
      WHERE metric_name = 'traffic.page_view'
        AND occurred_at >= $1
        AND occurred_at <= $2
        AND is_archived = false
      ORDER BY occurred_at DESC
      LIMIT $3
      `,
      [query.from, query.to, limits.recent],
    );

    const overview = overviewRes.rows[0] ?? {
      page_views: 0,
      unique_sessions: 0,
      tracked_routes: 0,
      external_referrals: 0,
    };

    return {
      overview: {
        pageViews: Number(overview.page_views ?? 0),
        uniqueSessions: Number(overview.unique_sessions ?? 0),
        trackedRoutes: Number(overview.tracked_routes ?? 0),
        externalReferrals: Number(overview.external_referrals ?? 0),
      },
      viewsByDay: viewsByDayRes.rows.map((row) => ({
        date: row.date,
        views: Number(row.views ?? 0),
      })),
      routes: routesRes.rows.map((row) => ({
        path: row.path,
        views: Number(row.views ?? 0),
        uniqueSessions: Number(row.unique_sessions ?? 0),
        avgDurationMs: Number(row.avg_duration_ms ?? 0),
      })),
      referrers: referrersRes.rows.map((row) => ({
        referrer: row.referrer,
        views: Number(row.views ?? 0),
      })),
      recentViews: recentViewsRes.rows.map((row) => ({
        id: String(row.id),
        occurredAt: new Date(row.occurred_at).toISOString(),
        path: row.path ?? null,
        fullPath: row.full_path ?? null,
        referrerHost: row.referrer_host ?? null,
        sessionId: row.session_id ?? null,
        viewport:
          row.viewport &&
          typeof row.viewport.width === "number" &&
          typeof row.viewport.height === "number"
            ? { width: row.viewport.width, height: row.viewport.height }
            : null,
        durationMs: Number(row.duration_ms ?? 0),
      })),
    };
  }
}
