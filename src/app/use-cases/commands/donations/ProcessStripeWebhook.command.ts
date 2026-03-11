import { CreateLog } from "../logs/CreateLog.command";
import { UserCacheService } from "../../../app-services/users/UserCache.service";
import { DonationCacheService } from "../../../app-services/donations/DonationCache.service";
import { IDonation } from "../../../interfaces/Donation.port";
import { IPaymentGateway, PaymentWebhookEvent } from "../../../interfaces/PaymentGateway.port";
import { IStripeWebhookEvent } from "../../../interfaces/StripeWebhookEvent.port";
import { IUser } from "../../../interfaces/User.port";
import { ConfirmDonationBySession } from "./ConfirmDonationBySession.command";
import { Donation } from "../../../../domain/aggregates/Donation";
import { Uuid } from "../../../../domain/aggregates/User";
import { ErrorFactory } from "../../../../utils/errors/Error.map";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asUnixDate(value: unknown): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function firstInvoicePeriod(invoice: Record<string, unknown>): { start: Date | null; end: Date | null } {
  const lines = asObject(invoice.lines);
  const data = Array.isArray(lines.data) ? lines.data : [];
  const firstLine = data.length > 0 ? asObject(data[0]) : {};
  const period = asObject(firstLine.period);
  return {
    start: asUnixDate(period.start),
    end: asUnixDate(period.end),
  };
}

export class ProcessStripeWebhook {
  constructor(
    private readonly paymentGateway: IPaymentGateway,
    private readonly stripeWebhookEvents: IStripeWebhookEvent,
    private readonly donationRepo: IDonation,
    private readonly donationCache: DonationCacheService,
    private readonly userRepo: IUser,
    private readonly userCache: UserCacheService,
    private readonly confirmDonationBySession: ConfirmDonationBySession,
    private readonly createLog: CreateLog,
    private readonly webhookSecret: string,
  ) {}

  private async log(level: "info" | "warn" | "error", message: string, context: Record<string, unknown>) {
    await this.createLog.execute({
      source: "stripe.webhook",
      level,
      category: level === "error" ? "infrastructure" : "audit",
      message,
      method: "POST",
      path: "/stripe/webhook",
      statusCode: level === "error" ? 500 : 200,
      tags: ["stripe", "webhook"],
      context,
    });
  }

  private async syncSupporterState(donation: Donation): Promise<void> {
    await this.donationRepo.refreshSupporterProgress(donation.userId);

    if (donation.status !== "active" && donation.status !== "completed") {
      return;
    }

    const user = await this.userRepo.findById(Uuid.create(donation.userId));
    if (!user || user.isSupporter) {
      return;
    }

    user.markSupporter();
    const savedUser = await this.userRepo.save(user);
    await this.userCache.setUser(savedUser);
  }

  private async saveDonation(donation: Donation): Promise<void> {
    const saved = await this.donationRepo.save(donation);
    await this.donationCache.invalidateForMutation(saved);
    await this.syncSupporterState(saved);
  }

  private async processInvoicePaid(event: PaymentWebhookEvent): Promise<void> {
    const invoice = asObject(event.data.object);
    const subscriptionId = asString(invoice.subscription);
    if (!subscriptionId) {
      return;
    }

    const donation = await this.donationRepo.findByProviderSubscriptionId(subscriptionId);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: subscriptionId,
      });
    }

    const customerId = asString(invoice.customer);
    const period = firstInvoicePeriod(invoice);
    donation.activateRecurring({
      providerCustomerId: customerId ?? donation.providerCustomerId,
      providerSubscriptionId: subscriptionId,
      currentPeriodStart: period.start ?? donation.currentPeriodStart,
      currentPeriodEnd: period.end ?? donation.currentPeriodEnd,
    });
    await this.saveDonation(donation);
  }

  private async processInvoicePaymentFailed(event: PaymentWebhookEvent): Promise<void> {
    const invoice = asObject(event.data.object);
    const subscriptionId = asString(invoice.subscription);
    if (!subscriptionId) {
      return;
    }

    const donation = await this.donationRepo.findByProviderSubscriptionId(subscriptionId);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: subscriptionId,
      });
    }

    if (donation.status !== "failed") {
      donation.fail();
      await this.saveDonation(donation);
    }
  }

  private async processSubscriptionDeleted(event: PaymentWebhookEvent): Promise<void> {
    const subscription = asObject(event.data.object);
    const subscriptionId = asString(subscription.id);
    if (!subscriptionId) {
      return;
    }

    const donation = await this.donationRepo.findByProviderSubscriptionId(subscriptionId);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: subscriptionId,
      });
    }

    if (donation.status !== "canceled") {
      donation.cancel();
      await this.saveDonation(donation);
    }
  }

  async execute(input: { payload: Buffer | string; signature: string }): Promise<{ duplicate: boolean }> {
    const event = this.paymentGateway.constructWebhookEvent({
      payload: input.payload,
      signature: input.signature,
      webhookSecret: this.webhookSecret,
    });

    const object = asObject(event.data.object);
    const sessionId = asString(object.id);
    const subscriptionId = asString(object.subscription);
    const customerId = asString(object.customer);

    const received = await this.stripeWebhookEvents.recordReceived({
      id: event.id,
      eventType: event.type,
      apiVersion: event.apiVersion,
      livemode: event.livemode,
      payload: { id: event.id, type: event.type, data: event.data, livemode: event.livemode },
      relatedSessionId: event.type === "checkout.session.completed" ? sessionId : null,
      relatedSubscriptionId:
        event.type === "customer.subscription.deleted"
          ? sessionId
          : subscriptionId,
      relatedCustomerId: customerId,
    });

    await this.log("info", `Stripe webhook received: ${event.type}`, {
      eventId: event.id,
      attemptCount: received.attemptCount,
      eventType: event.type,
    });

    if (received.status === "processed" || received.status === "ignored") {
      return { duplicate: true };
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const checkoutSessionId = asString(object.id);
          if (!checkoutSessionId) {
            throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", {
              field: "checkoutSessionId",
            });
          }
          await this.confirmDonationBySession.execute(checkoutSessionId);
          await this.stripeWebhookEvents.markProcessed(event.id);
          break;
        }
        case "invoice.paid":
          await this.processInvoicePaid(event);
          await this.stripeWebhookEvents.markProcessed(event.id);
          break;
        case "invoice.payment_failed":
          await this.processInvoicePaymentFailed(event);
          await this.stripeWebhookEvents.markProcessed(event.id);
          break;
        case "customer.subscription.deleted":
          await this.processSubscriptionDeleted(event);
          await this.stripeWebhookEvents.markProcessed(event.id);
          break;
        default:
          await this.stripeWebhookEvents.markProcessed(event.id, "ignored");
          break;
      }

      await this.log("info", `Stripe webhook processed: ${event.type}`, {
        eventId: event.id,
        eventType: event.type,
      });
      return { duplicate: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stripeWebhookEvents.markFailed(event.id, message);
      await this.log("error", `Stripe webhook failed: ${event.type}`, {
        eventId: event.id,
        eventType: event.type,
        errorMessage: message,
      });
      throw error;
    }
  }
}
