export type BanSource = "admin" | "system";

export type UserBan = {
  id: string;
  userId: string;
  reason: string;
  source: BanSource;
  bannedBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
};

export type IpBan = {
  id: string;
  ipAddress: string;
  reason: string;
  source: BanSource;
  bannedBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
};

export interface ISecurityBan {
  banUser(input: {
    userId: string;
    reason: string;
    source: BanSource;
    bannedBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<UserBan>;
  unbanUser(userId: string, revokedBy?: string | null): Promise<number>;
  findActiveUserBan(userId: string): Promise<UserBan | null>;
  listActiveUserBans(limit?: number): Promise<UserBan[]>;

  banIp(input: {
    ipAddress: string;
    reason: string;
    source: BanSource;
    bannedBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<IpBan>;
  unbanIp(ipAddress: string, revokedBy?: string | null): Promise<number>;
  findActiveIpBan(ipAddress: string): Promise<IpBan | null>;
  listActiveIpBans(limit?: number): Promise<IpBan[]>;
}
