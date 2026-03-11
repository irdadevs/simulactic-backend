import { Request, Response } from "express";
import { CreateDonationCheckout } from "../../app/use-cases/commands/donations/CreateDonationCheckout.command";
import { ConfirmDonationBySession } from "../../app/use-cases/commands/donations/ConfirmDonationBySession.command";
import { CancelDonation } from "../../app/use-cases/commands/donations/CancelDonation.command";
import { CreateCustomerPortalSession } from "../../app/use-cases/commands/donations/CreateCustomerPortalSession.command";
import { FindDonation } from "../../app/use-cases/queries/donations/FindDonation.query";
import { ListDonations } from "../../app/use-cases/queries/donations/ListDonations.query";
import { ListSupporterBadges } from "../../app/use-cases/queries/donations/ListSupporterBadges.query";
import { CreateDonationCheckoutDTO } from "../security/donations/CreateDonationCheckout.dto";
import { CreateCustomerPortalSessionDTO } from "../security/donations/CreateCustomerPortalSession.dto";
import { ConfirmDonationBySessionDTO } from "../security/donations/ConfirmDonationBySession.dto";
import { ListDonationsDTO } from "../security/donations/ListDonations.dto";
import { CancelDonationDTO } from "../security/donations/CancelDonation.dto";
import { FindDonationByIdDTO } from "../security/donations/FindDonationById.dto";
import invalidBody from "../../utils/invalidBody";
import errorHandler from "../../utils/errors/Errors.handler";
import { presentDonation, presentDonationAdmin } from "../presenters/Aggregate.presenter";

export class DonationController {
  constructor(
    private readonly createDonationCheckout: CreateDonationCheckout,
    private readonly createCustomerPortalSession: CreateCustomerPortalSession,
    private readonly confirmDonationBySession: ConfirmDonationBySession,
    private readonly cancelDonation: CancelDonation,
    private readonly findDonation: FindDonation,
    private readonly listDonations: ListDonations,
    private readonly listSupporterBadges: ListSupporterBadges,
  ) {}

  private isAdmin(req: Request): boolean {
    return req.auth.userRole === "Admin";
  }

  private wantsDashboardView(req: Request): boolean {
    return this.isAdmin(req) && req.query.view === "dashboard";
  }

  public createCheckout = async (req: Request, res: Response) => {
    try {
      const parsed = CreateDonationCheckoutDTO.safeParse(req.body);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const result = await this.createDonationCheckout.execute({
        ...parsed.data,
        userId: req.auth.userId,
      });

      return res.status(201).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public createPortalSession = async (req: Request, res: Response) => {
    try {
      const parsedBody = CreateCustomerPortalSessionDTO.safeParse(req.body);
      if (!parsedBody.success) return invalidBody(res, parsedBody.error);

      const result = await this.createCustomerPortalSession.execute(req.auth.userId, parsedBody.data);
      return res.status(200).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public confirmBySession = async (req: Request, res: Response) => {
    try {
      const parsed = ConfirmDonationBySessionDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const donation = await this.findDonation.byProviderSessionId(parsed.data.sessionId);
      if (!donation) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      if (!this.isAdmin(req) && donation.userId !== req.auth.userId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      await this.confirmDonationBySession.execute(parsed.data.sessionId);
      return res.status(204).send();
    } catch (err: unknown) {
      // TEST AND DELETE DEBUGGING NOTE
      console.error("[DONATION] confirm failed:", err);
      return errorHandler(err, res);
    }
  };

  public cancel = async (req: Request, res: Response) => {
    try {
      const parsed = CancelDonationDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const donation = await this.findDonation.byId(parsed.data.id);
      if (!donation) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      if (!this.isAdmin(req) && donation.userId !== req.auth.userId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      await this.cancelDonation.execute(parsed.data.id);
      return res.status(204).send();
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindDonationByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const donation = await this.findDonation.byId(parsed.data.id);
      if (!donation) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }

      if (!this.isAdmin(req) && donation.userId !== req.auth.userId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      if (this.wantsDashboardView(req)) {
        return res.status(200).json(presentDonationAdmin(donation));
      }
      return res.status(200).json(presentDonation(donation));
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      const parsed = ListDonationsDTO.safeParse(req.query);
      if (!parsed.success) return invalidBody(res, parsed.error);

      const query = this.isAdmin(req)
        ? parsed.data
        : {
            ...parsed.data,
            userId: req.auth.userId,
          };

      const result = await this.listDonations.execute(query);
      const mapDonation = this.wantsDashboardView(req) ? presentDonationAdmin : presentDonation;
      return res.status(200).json({
        rows: result.rows.map((row) => mapDonation(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public listBadges = async (_req: Request, res: Response) => {
    try {
      const result = await this.listSupporterBadges.execute();
      return res.status(200).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
