export type StripeWebhookEventStatus = "received" | "processed" | "failed" | "ignored";

export type StripeWebhookEventRecord = {
  id: string;
  eventType: string;
  apiVersion: string | null;
  livemode: boolean;
  status: StripeWebhookEventStatus;
  attemptCount: number;
  payload: Record<string, unknown>;
  relatedSessionId: string | null;
  relatedSubscriptionId: string | null;
  relatedCustomerId: string | null;
  errorMessage: string | null;
  processedAt: Date | null;
  failedAt: Date | null;
  lastReceivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface IStripeWebhookEvent {
  recordReceived(input: {
    id: string;
    eventType: string;
    apiVersion: string | null;
    livemode: boolean;
    payload: Record<string, unknown>;
    relatedSessionId?: string | null;
    relatedSubscriptionId?: string | null;
    relatedCustomerId?: string | null;
  }): Promise<StripeWebhookEventRecord>;
  markProcessed(id: string, status?: "processed" | "ignored"): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
}
