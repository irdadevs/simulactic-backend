import { DonationType } from "../../domain/aggregates/Donation";

export type PaymentSessionResult = {
  sessionId: string;
  url: string;
};

export type RetrievedCheckoutSession = {
  sessionId: string;
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  customerId: string | null;
  subscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

export interface IPaymentGateway {
  createCheckoutSession(params: {
    donationType: DonationType;
    amountMinor: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentSessionResult>;
  retrieveCheckoutSession(sessionId: string): Promise<RetrievedCheckoutSession>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  createCustomerPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
}
