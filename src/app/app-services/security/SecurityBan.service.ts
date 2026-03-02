import { UserCacheService } from "../users/UserCache.service";
import { ICache } from "../../interfaces/Cache.port";
import { ISession } from "../../interfaces/Session.port";
import { ISecurityBan, IpBan, UserBan } from "../../interfaces/SecurityBan.port";
import { IUser } from "../../interfaces/User.port";
import { ErrorFactory } from "../../../utils/errors/Error.map";
import { Uuid } from "../../../domain/aggregates/User";

type StrikeState = {
  count: number;
  firstAt: number;
};

const AUTO_BAN_STRIKE_WINDOW_SEC = 10 * 60;
const AUTO_BAN_IP_THRESHOLD = 30;
const AUTO_BAN_IP_DURATION_MS = 60 * 60 * 1000;

export class SecurityBanService {
  constructor(
    private readonly bans: ISecurityBan,
    private readonly users: IUser,
    private readonly sessions: ISession,
    private readonly userCache: UserCacheService,
    private readonly cache: ICache,
  ) {}

  normalizeIp(value: string): string {
    return value.trim().replace(/^::ffff:/i, "");
  }

  async isUserBanned(userId: string): Promise<boolean> {
    const active = await this.bans.findActiveUserBan(userId);
    return Boolean(active);
  }

  async isIpBanned(ipAddress: string): Promise<boolean> {
    const normalized = this.normalizeIp(ipAddress);
    const active = await this.bans.findActiveIpBan(normalized);
    return Boolean(active);
  }

  async assertUserNotBanned(userId: string): Promise<void> {
    if (await this.isUserBanned(userId)) {
      throw ErrorFactory.presentation("AUTH.USER_BANNED", { userId });
    }
  }

  async assertIpNotBanned(ipAddress: string): Promise<void> {
    const normalized = this.normalizeIp(ipAddress);
    if (await this.isIpBanned(normalized)) {
      throw ErrorFactory.presentation("AUTH.IP_BANNED", { ipAddress: normalized });
    }
  }

  async banUserByAdmin(input: {
    targetUserId: string;
    actorUserId: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<UserBan> {
    return this.banUser({
      targetUserId: input.targetUserId,
      source: "admin",
      actorUserId: input.actorUserId,
      reason: input.reason,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async banUserBySystem(input: {
    targetUserId: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<UserBan> {
    return this.banUser({
      targetUserId: input.targetUserId,
      source: "system",
      actorUserId: null,
      reason: input.reason,
      expiresAt: input.expiresAt ?? null,
    });
  }

  private async banUser(input: {
    targetUserId: string;
    source: "admin" | "system";
    actorUserId: string | null;
    reason: string;
    expiresAt: Date | null;
  }): Promise<UserBan> {
    const existing = await this.bans.findActiveUserBan(input.targetUserId);
    if (existing) {
      throw ErrorFactory.presentation("AUTH.BAN_ALREADY_ACTIVE", {
        target: "user",
        id: input.targetUserId,
      });
    }

    const user = await this.users.findById(Uuid.create(input.targetUserId));
    if (!user) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "user",
        id: input.targetUserId,
      });
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "reason" });
    }

    const created = await this.bans.banUser({
      userId: input.targetUserId,
      reason,
      source: input.source,
      bannedBy: input.actorUserId,
      expiresAt: input.expiresAt,
    });

    await this.sessions.revokeAllForUser(input.targetUserId);
    await this.userCache.invalidateBySnapshot({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    return created;
  }

  async unbanUserByAdmin(input: { targetUserId: string; actorUserId: string }): Promise<number> {
    return this.bans.unbanUser(input.targetUserId, input.actorUserId);
  }

  async banIpByAdmin(input: {
    ipAddress: string;
    actorUserId: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<IpBan> {
    return this.banIp({
      ipAddress: input.ipAddress,
      source: "admin",
      actorUserId: input.actorUserId,
      reason: input.reason,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async banIpBySystem(input: {
    ipAddress: string;
    reason: string;
    expiresAt?: Date | null;
  }): Promise<IpBan> {
    return this.banIp({
      ipAddress: input.ipAddress,
      source: "system",
      actorUserId: null,
      reason: input.reason,
      expiresAt: input.expiresAt ?? null,
    });
  }

  private async banIp(input: {
    ipAddress: string;
    source: "admin" | "system";
    actorUserId: string | null;
    reason: string;
    expiresAt: Date | null;
  }): Promise<IpBan> {
    const ipAddress = this.normalizeIp(input.ipAddress);
    if (!ipAddress) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "ipAddress" });
    }

    const existing = await this.bans.findActiveIpBan(ipAddress);
    if (existing) {
      throw ErrorFactory.presentation("AUTH.BAN_ALREADY_ACTIVE", {
        target: "ip",
        id: ipAddress,
      });
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", { field: "reason" });
    }

    const created = await this.bans.banIp({
      ipAddress,
      reason,
      source: input.source,
      bannedBy: input.actorUserId,
      expiresAt: input.expiresAt,
    });
    await this.cache.del(this.strikeKey(ipAddress));
    return created;
  }

  async unbanIpByAdmin(input: { ipAddress: string; actorUserId: string }): Promise<number> {
    const ipAddress = this.normalizeIp(input.ipAddress);
    const count = await this.bans.unbanIp(ipAddress, input.actorUserId);
    await this.cache.del(this.strikeKey(ipAddress));
    return count;
  }

  async listActiveBans(limit = 100): Promise<{ users: UserBan[]; ips: IpBan[] }> {
    const [users, ips] = await Promise.all([
      this.bans.listActiveUserBans(limit),
      this.bans.listActiveIpBans(limit),
    ]);
    return { users, ips };
  }

  async registerSuspiciousSignal(input: {
    ipAddress?: string | null;
    statusCode: number;
    method: string;
    path?: string | null;
  }): Promise<void> {
    const ip = input.ipAddress ? this.normalizeIp(input.ipAddress) : "";
    if (!ip) return;
    const isLoginFailure =
      input.statusCode === 400 &&
      input.method.toUpperCase() === "POST" &&
      (input.path ?? "").includes("/users/login");
    if (!isLoginFailure && ![401, 403, 429].includes(input.statusCode)) return;
    if (input.method === "OPTIONS") return;
    if (await this.isIpBanned(ip)) return;

    const key = this.strikeKey(ip);
    const state = (await this.cache.get<StrikeState>(key)) ?? {
      count: 0,
      firstAt: Date.now(),
    };
    if (isLoginFailure) {
      state.count += 2;
    } else {
      state.count += input.statusCode === 429 ? 3 : 1;
    }

    await this.cache.set(key, state, AUTO_BAN_STRIKE_WINDOW_SEC);

    if (state.count < AUTO_BAN_IP_THRESHOLD) return;

    await this.banIpBySystem({
      ipAddress: ip,
      reason: `Auto-ban after ${state.count} suspicious requests in ${AUTO_BAN_STRIKE_WINDOW_SEC / 60} minutes`,
      expiresAt: new Date(Date.now() + AUTO_BAN_IP_DURATION_MS),
    });
  }

  private strikeKey(ipAddress: string): string {
    return `security:auto-ban:ip:${ipAddress}`;
  }
}
