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

  async login(dto: LoginDTO, meta?: { userAgent?: string; ip?: string }) {
    if (meta?.ip) {
      await this.securityBan.assertIpNotBanned(meta.ip);
    }

    const user = await this.loginUser.execute(dto);
    await this.securityBan.assertUserNotBanned(user.id);

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
