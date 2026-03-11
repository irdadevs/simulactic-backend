import {
  IStripeWebhookEvent,
  StripeWebhookEventRecord,
} from "../../app/interfaces/StripeWebhookEvent.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";

export class StripeWebhookEventRepo implements IStripeWebhookEvent {
  constructor(private readonly db: Queryable) {}

  private mapRow(row: QueryResultRow): StripeWebhookEventRecord {
    return {
      id: String(row.id),
      eventType: String(row.event_type),
      apiVersion: row.api_version ?? null,
      livemode: Boolean(row.livemode),
      status: row.status,
      attemptCount: Number(row.attempt_count),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      relatedSessionId: row.related_session_id ?? null,
      relatedSubscriptionId: row.related_subscription_id ?? null,
      relatedCustomerId: row.related_customer_id ?? null,
      errorMessage: row.error_message ?? null,
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      lastReceivedAt: new Date(row.last_received_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async recordReceived(input: {
    id: string;
    eventType: string;
    apiVersion: string | null;
    livemode: boolean;
    payload: Record<string, unknown>;
    relatedSessionId?: string | null;
    relatedSubscriptionId?: string | null;
    relatedCustomerId?: string | null;
  }): Promise<StripeWebhookEventRecord> {
    const query = await this.db.query(
      `
      INSERT INTO billing.stripe_webhook_events (
        id,
        event_type,
        api_version,
        livemode,
        status,
        payload,
        related_session_id,
        related_subscription_id,
        related_customer_id
      )
      VALUES ($1,$2,$3,$4,'received',$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        api_version = EXCLUDED.api_version,
        livemode = EXCLUDED.livemode,
        payload = EXCLUDED.payload,
        related_session_id = EXCLUDED.related_session_id,
        related_subscription_id = EXCLUDED.related_subscription_id,
        related_customer_id = EXCLUDED.related_customer_id,
        attempt_count = billing.stripe_webhook_events.attempt_count + 1,
        last_received_at = now_utc(),
        updated_at = now_utc()
      RETURNING *
      `,
      [
        input.id,
        input.eventType,
        input.apiVersion,
        input.livemode,
        input.payload,
        input.relatedSessionId ?? null,
        input.relatedSubscriptionId ?? null,
        input.relatedCustomerId ?? null,
      ],
    );

    return this.mapRow(query.rows[0]);
  }

  async markProcessed(id: string, status: "processed" | "ignored" = "processed"): Promise<void> {
    await this.db.query(
      `
      UPDATE billing.stripe_webhook_events
      SET
        status = $2,
        error_message = NULL,
        failed_at = NULL,
        processed_at = now_utc(),
        updated_at = now_utc()
      WHERE id = $1
      `,
      [id, status],
    );
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db.query(
      `
      UPDATE billing.stripe_webhook_events
      SET
        status = 'failed',
        error_message = LEFT($2, 2000),
        failed_at = now_utc(),
        updated_at = now_utc()
      WHERE id = $1
      `,
      [id, errorMessage],
    );
  }
}
