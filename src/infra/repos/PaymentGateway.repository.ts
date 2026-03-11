import Stripe from "stripe";
import {
  IPaymentGateway,
  PaymentSessionResult,
  RetrievedCheckoutSession,
} from "../../app/interfaces/PaymentGateway.port";
import { ErrorFactory } from "../../utils/errors/Error.map";

type GatewayConfig = {
  secretKey?: string;
};

export class PaymentGatewayRepo implements IPaymentGateway {
  private readonly client: Stripe | null;

  constructor(config?: GatewayConfig) {
    const secretKey = config?.secretKey ?? process.env.STRIPE_SECRET_KEY;
    this.client = secretKey ? new Stripe(secretKey) : null;
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw ErrorFactory.infra("SHARED.DEPENDENCY_NOT_FOUND", {
        dep: "STRIPE_SECRET_KEY",
      });
    }
    return this.client;
  }

  async createCheckoutSession(params: {
    donationType: "one_time" | "monthly";
    amountMinor: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentSessionResult> {
    const normalizedCurrency = params.currency.trim().toLowerCase();

    const client = this.requireClient();
    const session = await client.checkout.sessions.create({
      mode: params.donationType === "monthly" ? "subscription" : "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: params.metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: normalizedCurrency,
            unit_amount: params.amountMinor,
            product_data: {
              name:
                params.donationType === "monthly"
                  ? "Monthly Simulactic Donation"
                  : "Simulactic Donation",
            },
            ...(params.donationType === "monthly"
              ? { recurring: { interval: "month" as const } }
              : {}),
          },
        },
      ],
    });

    if (!session.id || !session.url) {
      throw ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
        cause: "Stripe checkout session did not return id/url",
      });
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<RetrievedCheckoutSession> {
    const client = this.requireClient();

    const session = await client.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);

    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (subscriptionId) {
      const subscription = await client.subscriptions.retrieve(subscriptionId);

      const firstItem = (subscription as any)?.items?.data?.[0];

      const maybeStart = firstItem?.current_period_start;
      const maybeEnd = firstItem?.current_period_end;

      periodStart = typeof maybeStart === "number" ? new Date(maybeStart * 1000) : null;
      periodEnd = typeof maybeEnd === "number" ? new Date(maybeEnd * 1000) : null;
    }

    return {
      sessionId: session.id,
      status: session.status as "open" | "complete" | "expired",
      paymentStatus: session.payment_status as "paid" | "unpaid" | "no_payment_required",
      customerId:
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
      subscriptionId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const client = this.requireClient();
    await client.subscriptions.cancel(subscriptionId);
  }
}
