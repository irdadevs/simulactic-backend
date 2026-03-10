import { ILog, ListLogsQuery } from "../../app/interfaces/Log.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";
import { Log } from "../../domain/aggregates/Log";
import { paginateFrom, ParamBag } from "../../utils/Pagination";
import { ErrorFactory } from "../../utils/errors/Error.map";

export default class LogRepo implements ILog {
  constructor(private readonly db: Queryable) {}

  private mapRow(row: QueryResultRow): Log {
    return Log.rehydrate({
      id: String(row.id),
      source: row.source,
      level: row.level,
      category: row.category,
      message: row.message,
      context: row.context ?? {},
      userId: row.user_id ?? null,
      requestId: row.request_id ?? null,
      method: row.http_method ?? null,
      path: row.http_path ?? null,
      statusCode: row.status_code ?? null,
      ip: row.ip_address ?? null,
      userAgent: row.user_agent ?? null,
      fingerprint: row.fingerprint ?? null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      occurredAt: new Date(row.occurred_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
      resolvedBy: row.resolved_by ?? null,
      adminNote: row.admin_note ?? null,
      adminNoteUpdatedAt: row.admin_note_updated_at
        ? new Date(row.admin_note_updated_at)
        : null,
      adminNoteUpdatedBy: row.admin_note_updated_by ?? null,
    });
  }

  async save(log: Log): Promise<Log> {
    const json = log.toJSON();
    const insert = await this.db.query<{ id: string }>(
      `
      INSERT INTO logs.error_log (
        source,
        level,
        category,
        message,
        context,
        user_id,
        request_id,
        http_method,
        http_path,
        status_code,
        ip_address,
        user_agent,
        fingerprint,
        tags,
        occurred_at,
        resolved_at,
        resolved_by,
        admin_note,
        admin_note_updated_at,
        admin_note_updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      )
      RETURNING id
      `,
      [
        json.source,
        json.level,
        json.category,
        json.message,
        JSON.stringify(json.context ?? {}),
        json.userId,
        json.requestId,
        json.method,
        json.path,
        json.statusCode,
        json.ip,
        json.userAgent,
        json.fingerprint,
        json.tags,
        json.occurredAt,
        json.resolvedAt,
        json.resolvedBy,
        json.adminNote,
        json.adminNoteUpdatedAt,
        json.adminNoteUpdatedBy,
      ],
    );

    const id = String(insert.rows[0]?.id ?? "");
    const stored = await this.findById(id);
    if (!stored) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }
    return stored;
  }

  async findById(id: string): Promise<Log | null> {
    const query = await this.db.query(
      `
      SELECT
        id,
        source,
        level,
        category,
        message,
        context,
        user_id,
        request_id,
        http_method,
        http_path,
        status_code,
        ip_address,
        user_agent,
        fingerprint,
        tags,
        occurred_at,
        resolved_at,
        resolved_by,
        admin_note,
        admin_note_updated_at,
        admin_note_updated_by
      FROM logs.error_log
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async list(query: ListLogsQuery): Promise<{ rows: Log[]; total: number }> {
    const params = new ParamBag();
    const where: string[] = [];

    if (query.level) where.push(`level = ${params.add(query.level)}`);
    if (query.category) where.push(`category = ${params.add(query.category)}`);
    if (query.source?.trim()) where.push(`source = ${params.add(query.source.trim())}`);
    if (query.requestId?.trim()) where.push(`request_id = ${params.add(query.requestId.trim())}`);
    if (query.userId?.trim()) where.push(`user_id = ${params.add(query.userId.trim())}`);
    if (query.statusCode != null) where.push(`status_code = ${params.add(query.statusCode)}`);
    if (query.unresolvedOnly) where.push(`resolved_at IS NULL`);
    if (query.from) where.push(`occurred_at >= ${params.add(query.from)}`);
    if (query.to) where.push(`occurred_at <= ${params.add(query.to)}`);
    if (query.search?.trim()) {
      const q = `%${query.search.trim()}%`;
      where.push(`(message ILIKE ${params.add(q)} OR source ILIKE ${params.add(q)})`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const fromSql = `
      FROM logs.error_log
      ${whereSql}
      ${where.length > 0 ? "AND" : "WHERE"} is_archived = false
    `;

    const page = await paginateFrom<QueryResultRow>(this.db, fromSql, params.values, {
      select: `
        id,
        source,
        level,
        category,
        message,
        context,
        user_id,
        request_id,
        http_method,
        http_path,
        status_code,
        ip_address,
        user_agent,
        fingerprint,
        tags,
        occurred_at,
        resolved_at,
        resolved_by,
        admin_note,
        admin_note_updated_at,
        admin_note_updated_by
      `,
      orderMap: {
        occurredAt: "occurred_at",
        level: "level",
        category: "category",
      },
      orderBy: query.orderBy ?? "occurredAt",
      orderDir: query.orderDir ?? "desc",
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    return {
      rows: page.rows.map((row) => this.mapRow(row)),
      total: page.total,
    };
  }

  async resolve(id: string, byUserId: string): Promise<Log> {
    const res = await this.db.query(
      `
      UPDATE logs.error_log
      SET resolved_at = now_utc(), resolved_by = $2
      WHERE id = $1
      `,
      [id, byUserId],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }
    return updated;
  }

  async reopen(id: string): Promise<Log> {
    const res = await this.db.query(
      `
      UPDATE logs.error_log
      SET resolved_at = NULL, resolved_by = NULL
      WHERE id = $1
      `,
      [id],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }
    return updated;
  }

  async setAdminNote(id: string, note: string, byUserId: string): Promise<Log> {
    const res = await this.db.query(
      `
      UPDATE logs.error_log
      SET admin_note = $2, admin_note_updated_at = now_utc(), admin_note_updated_by = $3
      WHERE id = $1
      `,
      [id, note, byUserId],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }
    return updated;
  }

  async clearAdminNote(id: string, byUserId: string): Promise<Log> {
    const res = await this.db.query(
      `
      UPDATE logs.error_log
      SET admin_note = NULL, admin_note_updated_at = now_utc(), admin_note_updated_by = $2
      WHERE id = $1
      `,
      [id, byUserId],
    );

    if (res.rowCount === 0) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", { sourceType: "log", id });
    }
    return updated;
  }
}
