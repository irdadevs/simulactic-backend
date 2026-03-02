import { NextFunction, Request, Response } from "express";
import { SecurityBanService } from "../../app/app-services/security/SecurityBan.service";

export class SecurityGuardMiddleware {
  constructor(private readonly securityBan: SecurityBanService) {}

  blockBannedIp() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip ? this.securityBan.normalizeIp(req.ip) : "";
      if (!ip) return next();

      const isBanned = await this.securityBan.isIpBanned(ip);
      if (!isBanned) return next();

      return res.status(403).json({
        ok: false,
        error: "AUTH.IP_BANNED",
        message: "The current IP address is temporarily blocked.",
      });
    };
  }
}
