import { randomUUID } from "crypto";
import { LoginUser } from "../../use-cases/commands/users/LoginUser.command";
import { IJWT } from "../../interfaces/Jwt.port";
import { IHasher } from "../../interfaces/Hasher.port";
import { ISession } from "../../interfaces/Session.port";
import { LoginDTO } from "../../../presentation/security/users/Login.dto";
import { RefreshSession } from "../../use-cases/commands/users/RefreshSession.command";
import { LogoutSession } from "../../use-cases/commands/users/LogoutSession.command";
import { LogoutAllSessions } from "../../use-cases/commands/users/LogoutAllSessions.command";
import { IUser } from "../../interfaces/User.port";
import { Uuid } from "../../../domain/aggregates/User";
import { SecurityBanService } from "../security/SecurityBan.service";

export class AuthService {
  constructor(
    private readonly loginUser: LoginUser,
    private readonly refreshSession: RefreshSession,
    private readonly logoutSession: LogoutSession,
    private readonly logoutAllSessions: LogoutAllSessions,
    private readonly sessionRepo: ISession,
    private readonly jwt: IJWT,
    private readonly hasher: IHasher,
    private readonly userRepo: IUser,
    private readonly securityBan: SecurityBanService,
  ) {}

  private async safeAssertIpNotBanned(ip?: string): Promise<void> {
    if (!ip) return;
    try {
      await this.securityBan.assertIpNotBanned(ip);
    } catch (error) {
      // Keep auth path available if security-ban dependency is temporarily degraded.
      if (error instanceof Error && error.message.includes("security.ip_bans")) return;
      if (error instanceof Error && error.message.includes("timeout")) return;
      throw error;
    }
  }

  private async safeAssertUserNotBanned(userId: string): Promise<void> {
    try {
      await this.securityBan.assertUserNotBanned(userId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("security.user_bans")) return;
      if (error instanceof Error && error.message.includes("timeout")) return;
      throw error;
    }
  }

  async login(dto: LoginDTO, meta?: { userAgent?: string; ip?: string }) {
    await this.safeAssertIpNotBanned(meta?.ip);

    const user = await this.loginUser.execute(dto);
    await this.safeAssertUserNotBanned(user.id);

    const sessionId = randomUUID();

    const accessToken = this.jwt.signAccessToken({
      sub: user.id,
      kind: "user",
      userRole: user.role,
    });

    const refreshToken = this.jwt.signRefreshToken({
      sub: user.id,
      kind: "user",
      userRole: user.role,
      sessionId,
    });

    const hash = await this.hasher.hash(refreshToken);

    await this.sessionRepo.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hash,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.userRepo.touchActivity(Uuid.create(user.id));

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const tokens = await this.refreshSession.execute(refreshToken);
    const claims = this.jwt.verifyRefreshToken(refreshToken);
    if (claims.sub) {
      await this.userRepo.touchActivity(Uuid.create(claims.sub));
    }
    return tokens;
  }

  logout(sessionId: string) {
    return this.logoutSession.execute(sessionId);
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    const claims = this.jwt.verifyRefreshToken(refreshToken);
    if (!claims.sessionId) return;
    await this.logoutSession.execute(claims.sessionId);
  }

  logoutAll(userId: string) {
    return this.logoutAllSessions.execute(userId);
  }
}
