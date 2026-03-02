import { ISecurityBan, BanSource, IpBan, UserBan } from "../../app/interfaces/SecurityBan.port";
import { QueryResultRow, Queryable } from "../../config/db/Queryable";

const ACTIVE_BAN_CLAUSE = `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now_utc())`;

const normalizeIp = (value: string): string => value.trim().replace(/^::ffff:/i, "");

export class SecurityBanRepo implements ISecurityBan {
  constructor(private readonly db: Queryable) {}

  private mapUserBan(row: QueryResultRow): UserBan {
    return {
      id: String(row.id),
      userId: row.user_id,
      reason: row.reason,
      source: row.source as BanSource,
      bannedBy: row.banned_by ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? null,
      revokedAt: row.revoked_at ?? null,
      revokedBy: row.revoked_by ?? null,
    };
  }

  private mapIpBan(row: QueryResultRow): IpBan {
    return {
      id: String(row.id),
      ipAddress: row.ip_address,
      reason: row.reason,
      source: row.source as BanSource,
      bannedBy: row.banned_by ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? null,
      revokedAt: row.revoked_at ?? null,
      revokedBy: row.revoked_by ?? null,
    };
  }

  async banUser(input: {
    userId: string;
    reason: string;
    source: BanSource;
    bannedBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<UserBan> {
    const res = await this.db.query(
      `
      INSERT INTO security.user_bans (user_id, reason, source, banned_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [input.userId, input.reason, input.source, input.bannedBy ?? null, input.expiresAt ?? null],
    );

    return this.mapUserBan(res.rows[0]);
  }

  async unbanUser(userId: string, revokedBy?: string | null): Promise<number> {
    const res = await this.db.query(
      `
      UPDATE security.user_bans
      SET revoked_at = now_utc(), revoked_by = $2
      WHERE user_id = $1
        AND ${ACTIVE_BAN_CLAUSE}
      `,
      [userId, revokedBy ?? null],
    );

    return res.rowCount;
  }

  async findActiveUserBan(userId: string): Promise<UserBan | null> {
    const res = await this.db.query(
      `
      SELECT *
      FROM security.user_bans
      WHERE user_id = $1
        AND ${ACTIVE_BAN_CLAUSE}
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId],
    );

    return res.rowCount > 0 ? this.mapUserBan(res.rows[0]) : null;
  }

  async listActiveUserBans(limit = 100): Promise<UserBan[]> {
    const res = await this.db.query(
      `
      SELECT *
      FROM security.user_bans
      WHERE ${ACTIVE_BAN_CLAUSE}
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [Math.max(1, Math.min(500, limit))],
    );

    return res.rows.map((row) => this.mapUserBan(row));
  }

  async banIp(input: {
    ipAddress: string;
    reason: string;
    source: BanSource;
    bannedBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<IpBan> {
    const ipAddress = normalizeIp(input.ipAddress);
    const res = await this.db.query(
      `
      INSERT INTO security.ip_bans (ip_address, reason, source, banned_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [ipAddress, input.reason, input.source, input.bannedBy ?? null, input.expiresAt ?? null],
    );

    return this.mapIpBan(res.rows[0]);
  }

  async unbanIp(ipAddress: string, revokedBy?: string | null): Promise<number> {
    const normalized = normalizeIp(ipAddress);
    const res = await this.db.query(
      `
      UPDATE security.ip_bans
      SET revoked_at = now_utc(), revoked_by = $2
      WHERE ip_address = $1
        AND ${ACTIVE_BAN_CLAUSE}
      `,
      [normalized, revokedBy ?? null],
    );

    return res.rowCount;
  }

  async findActiveIpBan(ipAddress: string): Promise<IpBan | null> {
    const normalized = normalizeIp(ipAddress);
    const res = await this.db.query(
      `
      SELECT *
      FROM security.ip_bans
      WHERE ip_address = $1
        AND ${ACTIVE_BAN_CLAUSE}
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normalized],
    );

    return res.rowCount > 0 ? this.mapIpBan(res.rows[0]) : null;
  }

  async listActiveIpBans(limit = 100): Promise<IpBan[]> {
    const res = await this.db.query(
      `
      SELECT *
      FROM security.ip_bans
      WHERE ${ACTIVE_BAN_CLAUSE}
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [Math.max(1, Math.min(500, limit))],
    );

    return res.rows.map((row) => this.mapIpBan(row));
  }
}
