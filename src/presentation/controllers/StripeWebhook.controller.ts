import { Request, Response } from "express";
import errorHandler from "../../utils/errors/Errors.handler";
import { ProcessStripeWebhook } from "../../app/use-cases/commands/donations/ProcessStripeWebhook.command";

export class StripeWebhookController {
  constructor(private readonly processStripeWebhook: ProcessStripeWebhook) {}

  public handle = async (req: Request, res: Response) => {
    try {
      const signature = req.header("stripe-signature");
      if (!signature) {
        return res.status(400).json({ ok: false, error: "MISSING_STRIPE_SIGNATURE" });
      }

      const payload = req.body;
      if (!Buffer.isBuffer(payload) && typeof payload !== "string") {
        return res.status(400).json({ ok: false, error: "INVALID_STRIPE_PAYLOAD" });
      }

      await this.processStripeWebhook.execute({ payload, signature });
      return res.status(200).json({ received: true });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
