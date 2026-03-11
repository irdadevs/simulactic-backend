import { Response, Request } from "express";
import { PlatformService } from "../../app/app-services/users/Platform.service";
import { LifecycleService } from "../../app/app-services/users/Lifecycle.service";
import { HealthQuery } from "../../app/use-cases/queries/Health.query";
import { AuthService } from "../../app/app-services/users/Auth.service";
import { ChangeEmailDTO } from "../security/users/ChangeEmail.dto";
import { ChangePasswordDTO } from "../security/users/ChangePassword.dto";
import { ChangeRoleDTO } from "../security/users/ChangeRole.dto";
import { ChangeUsernameDTO } from "../security/users/ChangeUsername.dto";
import { CreateAdminDTO } from "../security/users/CreateAdmin.dto";
import { FindUserByEmailDTO } from "../security/users/FindUserByEmail.dto";
import { FindUserByIdDTO } from "../security/users/FindUserById.dto";
import { FindUserByUsernameDTO } from "../security/users/FindUserByUsername.dto";
import { LoginDTO } from "../security/users/Login.dto";
import { LogoutDTO } from "../security/users/Logout.dto";
import { RefreshDTO } from "../security/users/Refresh.dto";
import { ResendVerificationDTO } from "../security/users/ResendVerification.dto";
import { RestoreDTO } from "../security/users/Restore.dto";
import { SignupDTO } from "../security/users/Signup.dto";
import { SoftDeleteDTO } from "../security/users/SoftDelete.dto";
import { VerifyDTO } from "../security/users/Verify.dto";
import { BanUserDTO } from "../security/users/BanUser.dto";
import { BanIpDTO } from "../security/users/BanIp.dto";
import { UnbanIpDTO } from "../security/users/UnbanIp.dto";
import { ListActiveBansDTO } from "../security/users/ListActiveBans.dto";
import FindUser from "../../app/use-cases/queries/users/FindUser.query";
import { ListUsers } from "../../app/use-cases/queries/users/ListUsers.query";
import { UserListItem } from "../../app/interfaces/User.port";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { ListUsersDTO } from "../security/users/ListUsers.dto";
import { Email, User, Username, Uuid } from "../../domain/aggregates/User";
import { AUTH_COOKIE_NAMES, getCookie } from "../../utils/Cookies";
import { TOKEN_TIMES_MAP } from "../../utils/TokenTimes.map";
import { SecurityBanService } from "../../app/app-services/security/SecurityBan.service";
import { GetSupporterProgress } from "../../app/use-cases/queries/donations/GetSupporterProgress.query";

export class UserController {
  constructor(
    private readonly healthCheck: HealthQuery,
    private readonly findUser: FindUser,
    private readonly listUsers: ListUsers,
    private readonly authService: AuthService,
    private readonly platformService: PlatformService,
    private readonly lifecycleService: LifecycleService,
    private readonly securityBan: SecurityBanService,
    private readonly getSupporterProgress: GetSupporterProgress,
  ) {}

  private isAdmin(req: Request): boolean {
    return req.auth.userRole === "Admin";
  }

  private wantsDashboardView(req: Request): boolean {
    return this.isAdmin(req) && req.query.view === "dashboard";
  }

  private cookieOptions(maxAgeMs: number) {
    const isProd = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ("none" as const) : ("lax" as const),
      path: "/",
      maxAge: maxAgeMs,
    };
  }

  private clearCookieOptions() {
    const isProd = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ("none" as const) : ("lax" as const),
      path: "/",
    };
  }

  private getRefreshTokenFromRequest(req: Request): string | null {
    return getCookie(req, AUTH_COOKIE_NAMES.refreshToken) ?? null;
  }

  private toIsoOrNull(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private toPublicUserFromAggregate(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      verified: user.isVerified,
      isDeleted: user.isDeleted,
      isArchived: user.isArchived,
      isSupporter: user.isSupporter,
      createdAt: user.createdAt.toISOString(),
      lastActivityAt: user.lastActivityAt.toISOString(),
      verifiedAt: this.toIsoOrNull(user.verifiedAt),
      deletedAt: this.toIsoOrNull(user.deletedAt),
      archivedAt: this.toIsoOrNull(user.archivedAt),
      supporterFrom: this.toIsoOrNull(user.supporterFrom),
    };
  }

  private toAdminDashboardUserFromAggregate(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified,
      isDeleted: user.isDeleted,
      isArchived: user.isArchived,
      isSupporter: user.isSupporter,
      createdAt: user.createdAt.toISOString(),
      lastActivityAt: user.lastActivityAt.toISOString(),
      verifiedAt: this.toIsoOrNull(user.verifiedAt),
      deletedAt: this.toIsoOrNull(user.deletedAt),
      archivedAt: this.toIsoOrNull(user.archivedAt),
      supporterFrom: this.toIsoOrNull(user.supporterFrom),
      verificationCodeActive: Boolean(user.verificationCode),
      verificationCodeExpiresAt: this.toIsoOrNull(user.verificationCodeExpiresAt),
    };
  }

  private toPublicUserFromListItem(user: UserListItem) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      verified: user.verified,
      isDeleted: user.isDeleted,
      isArchived: user.isArchived,
      isSupporter: user.isSupporter,
      createdAt: user.createdAt.toISOString(),
      lastActivityAt: user.lastActivityAt.toISOString(),
      verifiedAt: this.toIsoOrNull(user.verifiedAt),
      deletedAt: this.toIsoOrNull(user.deletedAt),
      archivedAt: this.toIsoOrNull(user.archivedAt),
      supporterFrom: this.toIsoOrNull(user.supporterFrom),
    };
  }

  private toAdminDashboardUserFromListItem(user: UserListItem) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isVerified: user.verified,
      isDeleted: user.isDeleted,
      isArchived: user.isArchived,
      isSupporter: user.isSupporter,
      createdAt: user.createdAt.toISOString(),
      lastActivityAt: user.lastActivityAt.toISOString(),
      verifiedAt: this.toIsoOrNull(user.verifiedAt),
      deletedAt: this.toIsoOrNull(user.deletedAt),
      archivedAt: this.toIsoOrNull(user.archivedAt),
      supporterFrom: this.toIsoOrNull(user.supporterFrom),
    };
  }

  public health = async (_req: Request, res: Response) => {
    try {
      const result = await this.healthCheck.execute("auth");
      return res.status(200).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public login = async (req: Request, res: Response) => {
    try {
      const parsed = LoginDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const result = await this.authService.login(parsed.data, {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      });

      res.cookie(
        AUTH_COOKIE_NAMES.accessToken,
        result.accessToken,
        this.cookieOptions(TOKEN_TIMES_MAP.fifteenMinutes * 1000),
      );
      res.cookie(
        AUTH_COOKIE_NAMES.refreshToken,
        result.refreshToken,
        this.cookieOptions(TOKEN_TIMES_MAP.oneWeek * 1000),
      );

      return res.status(200).json({
        user: this.toPublicUserFromAggregate(result.user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public refresh = async (req: Request, res: Response) => {
    try {
      const cookieRefreshToken = this.getRefreshTokenFromRequest(req);
      let refreshToken = cookieRefreshToken;

      if (!refreshToken) {
        const parsed = RefreshDTO.safeParse(req.body);
        if (!parsed.success) {
          return invalidBody(res, parsed.error);
        }
        refreshToken = parsed.data.refreshToken;
      }

      const tokens = await this.authService.refresh(refreshToken);
      res.cookie(
        AUTH_COOKIE_NAMES.accessToken,
        tokens.accessToken,
        this.cookieOptions(TOKEN_TIMES_MAP.fifteenMinutes * 1000),
      );
      res.cookie(
        AUTH_COOKIE_NAMES.refreshToken,
        tokens.refreshToken,
        this.cookieOptions(TOKEN_TIMES_MAP.oneWeek * 1000),
      );

      return res.status(200).json({ ok: true });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public logout = async (req: Request, res: Response) => {
    try {
      const refreshToken = this.getRefreshTokenFromRequest(req);
      if (refreshToken) {
        await this.authService.logoutByRefreshToken(refreshToken);
      } else {
        const parsed = LogoutDTO.safeParse(req.body);
        if (!parsed.success) {
          return invalidBody(res, parsed.error);
        }

        await this.authService.logout(parsed.data.sessionId);
      }
      res.clearCookie(AUTH_COOKIE_NAMES.accessToken, this.clearCookieOptions());
      res.clearCookie(AUTH_COOKIE_NAMES.refreshToken, this.clearCookieOptions());

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public logoutAll = async (req: Request, res: Response) => {
    try {
      await this.authService.logoutAll(req.auth.userId);
      res.clearCookie(AUTH_COOKIE_NAMES.accessToken, this.clearCookieOptions());
      res.clearCookie(AUTH_COOKIE_NAMES.refreshToken, this.clearCookieOptions());

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public signup = async (req: Request, res: Response) => {
    try {
      const parsed = SignupDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const user = await this.platformService.signup(parsed.data);

      return res.status(201).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public createAdmin = async (req: Request, res: Response) => {
    try {
      const parsed = CreateAdminDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const user = await this.platformService.createAdmin(parsed.data);

      return res.status(201).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeEmail = async (req: Request, res: Response) => {
    try {
      const parsed = ChangeEmailDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.platformService.changeEmail(Uuid.create(req.auth.userId), parsed.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changePassword = async (req: Request, res: Response) => {
    try {
      const parsed = ChangePasswordDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.platformService.changePassword(Uuid.create(req.auth.userId), parsed.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeUsername = async (req: Request, res: Response) => {
    try {
      const parsed = ChangeUsernameDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.platformService.changeUsername(Uuid.create(req.auth.userId), parsed.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public changeRole = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindUserByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }

      const parsedBody = ChangeRoleDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      await this.platformService.changeRole(Uuid.create(parsedParams.data.id), parsedBody.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      const parsed = ListUsersDTO.safeParse(req.query);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const result = await this.listUsers.execute(parsed.data);
      const mapUser = this.wantsDashboardView(req)
        ? (row: UserListItem) => this.toAdminDashboardUserFromListItem(row)
        : (row: UserListItem) => this.toPublicUserFromListItem(row);
      return res.status(200).json({
        rows: result.rows.map((row) => mapUser(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public verify = async (req: Request, res: Response) => {
    try {
      const parsed = VerifyDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.platformService.verify(parsed.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public resendVerification = async (req: Request, res: Response) => {
    try {
      const parsed = ResendVerificationDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.platformService.resendVerification(parsed.data);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public softDelete = async (req: Request, res: Response) => {
    try {
      const parsed = SoftDeleteDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.lifecycleService.softDelete(Uuid.create(parsed.data.id));
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public selfSoftDelete = async (req: Request, res: Response) => {
    try {
      await this.lifecycleService.softDelete(Uuid.create(req.auth.userId));
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public restore = async (req: Request, res: Response) => {
    try {
      const parsed = RestoreDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.lifecycleService.restore(Uuid.create(parsed.data.id));
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public banUser = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindUserByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }
      const parsedBody = BanUserDTO.safeParse(req.body);
      if (!parsedBody.success) {
        return invalidBody(res, parsedBody.error);
      }

      const result = await this.securityBan.banUserByAdmin({
        targetUserId: parsedParams.data.id,
        actorUserId: req.auth.userId,
        reason: parsedBody.data.reason,
        expiresAt: parsedBody.data.expiresAt ?? null,
      });

      return res.status(201).json({
        id: result.id,
        userId: result.userId,
        reason: result.reason,
        source: result.source,
        bannedBy: result.bannedBy,
        createdAt: result.createdAt.toISOString(),
        expiresAt: this.toIsoOrNull(result.expiresAt),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public unbanUser = async (req: Request, res: Response) => {
    try {
      const parsedParams = FindUserByIdDTO.safeParse(req.params);
      if (!parsedParams.success) {
        return invalidBody(res, parsedParams.error);
      }

      await this.securityBan.unbanUserByAdmin({
        targetUserId: parsedParams.data.id,
        actorUserId: req.auth.userId,
      });

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public banIp = async (req: Request, res: Response) => {
    try {
      const parsed = BanIpDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const result = await this.securityBan.banIpByAdmin({
        ipAddress: parsed.data.ipAddress,
        actorUserId: req.auth.userId,
        reason: parsed.data.reason,
        expiresAt: parsed.data.expiresAt ?? null,
      });

      return res.status(201).json({
        id: result.id,
        ipAddress: result.ipAddress,
        reason: result.reason,
        source: result.source,
        bannedBy: result.bannedBy,
        createdAt: result.createdAt.toISOString(),
        expiresAt: this.toIsoOrNull(result.expiresAt),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public unbanIp = async (req: Request, res: Response) => {
    try {
      const parsed = UnbanIpDTO.safeParse(req.body);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      await this.securityBan.unbanIpByAdmin({
        ipAddress: parsed.data.ipAddress,
        actorUserId: req.auth.userId,
      });

      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public listActiveBans = async (req: Request, res: Response) => {
    try {
      const parsed = ListActiveBansDTO.safeParse(req.query);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const result = await this.securityBan.listActiveBans(parsed.data.limit);
      return res.status(200).json({
        users: result.users.map((row) => ({
          id: row.id,
          userId: row.userId,
          reason: row.reason,
          source: row.source,
          bannedBy: row.bannedBy,
          createdAt: row.createdAt.toISOString(),
          expiresAt: this.toIsoOrNull(row.expiresAt),
        })),
        ips: result.ips.map((row) => ({
          id: row.id,
          ipAddress: row.ipAddress,
          reason: row.reason,
          source: row.source,
          bannedBy: row.bannedBy,
          createdAt: row.createdAt.toISOString(),
          expiresAt: this.toIsoOrNull(row.expiresAt),
        })),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findUserById = async (req: Request, res: Response) => {
    try {
      const parsed = FindUserByIdDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const user = await this.findUser.byId(Uuid.create(parsed.data.id));
      if (this.wantsDashboardView(req)) {
        return res.status(200).json({
          user: this.toAdminDashboardUserFromAggregate(user),
        });
      }
      return res.status(200).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public me = async (req: Request, res: Response) => {
    try {
      const user = await this.findUser.byId(Uuid.create(req.auth.userId));
      if (this.wantsDashboardView(req)) {
        return res.status(200).json({
          user: this.toAdminDashboardUserFromAggregate(user),
        });
      }
      return res.status(200).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public mySupporterProgress = async (req: Request, res: Response) => {
    try {
      const progress = await this.getSupporterProgress.execute(req.auth.userId);
      return res.status(200).json({
        totalDonatedEurMinor: progress.totalDonatedEurMinor,
        monthlySupportingMonths: progress.monthlySupportingMonths,
        unlockedBadges: progress.unlockedBadges,
        amountBranch: progress.amountBranch,
        monthlyBranch: progress.monthlyBranch,
        updatedAt: this.toIsoOrNull(progress.updatedAt),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findUserByEmail = async (req: Request, res: Response) => {
    try {
      const parsed = FindUserByEmailDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const user = await this.findUser.byEmail(Email.create(parsed.data.email));
      if (this.wantsDashboardView(req)) {
        return res.status(200).json({
          user: this.toAdminDashboardUserFromAggregate(user),
        });
      }
      return res.status(200).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findUserByUsername = async (req: Request, res: Response) => {
    try {
      const parsed = FindUserByUsernameDTO.safeParse(req.params);
      if (!parsed.success) {
        return invalidBody(res, parsed.error);
      }

      const user = await this.findUser.byUsername(Username.create(parsed.data.username));
      if (this.wantsDashboardView(req)) {
        return res.status(200).json({
          user: this.toAdminDashboardUserFromAggregate(user),
        });
      }
      return res.status(200).json({
        user: this.toPublicUserFromAggregate(user),
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
