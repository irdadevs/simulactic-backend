import { NextFunction, Request, Response } from "express";
import { SecurityBanService } from "../../app/app-services/security/SecurityBan.service";

export class SecurityGuardMiddleware {
  constructor(private readonly securityBan: SecurityBanService) {}
  private static readonly IP_BAN_CHECK_TIMEOUT_MS = 800;

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`security_ban_check_timeout_${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  blockBannedIp() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip ? this.securityBan.normalizeIp(req.ip) : "";
      if (!ip) return next();

      let isBanned = false;
      try {
        isBanned = await this.withTimeout(
          this.securityBan.isIpBanned(ip),
          SecurityGuardMiddleware.IP_BAN_CHECK_TIMEOUT_MS,
        );
      } catch (_error) {
        // Fail-open to avoid hanging login and public routes when ban dependency is slow.
        return next();
      }
      if (!isBanned) return next();

      return res.status(403).json({
        ok: false,
        error: "AUTH.IP_BANNED",
        message: "The current IP address is temporarily blocked.",
      });
    };
  }
}
