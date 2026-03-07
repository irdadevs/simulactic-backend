import {
  IDonation,
  ListDonationsQuery,
  SupporterBadgeBranchProgress,
  SupporterProgress,
} from "../../app/interfaces/Donation.port";
import { Queryable, QueryResultRow } from "../../config/db/Queryable";
import { Donation } from "../../domain/aggregates/Donation";
import { paginateFrom, ParamBag } from "../../utils/Pagination";
import { ErrorFactory } from "../../utils/errors/Error.map";

export default class DonationRepo implements IDonation {
  constructor(private readonly db: Queryable) {}

  private static readonly EUR_MINOR_UNITS = 100;
  private static readonly AMOUNT_BADGE_THRESHOLDS_EUR_MINOR = [
    500, 2_000, 5_000, 10_000, 25_000, 50_000,
  ];
  private static readonly MONTHLY_BADGE_THRESHOLDS_MONTHS = [1, 3, 6, 12, 24, 36];

  private mapRow(row: QueryResultRow): Donation {
    return Donation.rehydrate({
      id: String(row.id),
      userId: String(row.user_id),
      donationType: row.donation_type,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      providerSessionId: row.provider_session_id,
      providerCustomerId: row.provider_customer_id ?? null,
      providerSubscriptionId: row.provider_subscription_id ?? null,
      currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : null,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async save(donation: Donation): Promise<Donation> {
    const json = donation.toJSON();
    await this.db.query(
      `
      INSERT INTO billing.donations (
        id, user_id, donation_type, amount_minor, currency, status, provider,
        provider_session_id, provider_customer_id, provider_subscription_id,
        current_period_start, current_period_end, canceled_at, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        donation_type = EXCLUDED.donation_type,
        amount_minor = EXCLUDED.amount_minor,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        provider = EXCLUDED.provider,
        provider_session_id = EXCLUDED.provider_session_id,
        provider_customer_id = EXCLUDED.provider_customer_id,
        provider_subscription_id = EXCLUDED.provider_subscription_id,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = now_utc()
      `,
      [
        json.id,
        json.userId,
        json.donationType,
        json.amountMinor,
        json.currency,
        json.status,
        json.provider,
        json.providerSessionId,
        json.providerCustomerId,
        json.providerSubscriptionId,
        json.currentPeriodStart,
        json.currentPeriodEnd,
        json.canceledAt,
        json.createdAt,
        json.updatedAt,
      ],
    );

    const stored = await this.findById(json.id);
    if (!stored) {
      throw ErrorFactory.infra("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: json.id,
      });
    }
    return stored;
  }

  async findById(id: string): Promise<Donation | null> {
    const query = await this.db.query(
      `
      SELECT
        id,
        user_id,
        donation_type,
        amount_minor,
        currency,
        status,
        provider,
        provider_session_id,
        provider_customer_id,
        provider_subscription_id,
        current_period_start,
        current_period_end,
        canceled_at,
        created_at,
        updated_at
      FROM billing.donations
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async findByProviderSessionId(sessionId: string): Promise<Donation | null> {
    const query = await this.db.query(
      `
      SELECT
        id,
        user_id,
        donation_type,
        amount_minor,
        currency,
        status,
        provider,
        provider_session_id,
        provider_customer_id,
        provider_subscription_id,
        current_period_start,
        current_period_end,
        canceled_at,
        created_at,
        updated_at
      FROM billing.donations
      WHERE provider_session_id = $1
      LIMIT 1
      `,
      [sessionId],
    );

    if (query.rowCount === 0) return null;
    return this.mapRow(query.rows[0]);
  }

  async list(query: ListDonationsQuery): Promise<{ rows: Donation[]; total: number }> {
    const params = new ParamBag();
    const where: string[] = ["is_archived = false"];

    if (query.userId?.trim()) where.push(`user_id = ${params.add(query.userId.trim())}`);
    if (query.donationType) where.push(`donation_type = ${params.add(query.donationType)}`);
    if (query.status) where.push(`status = ${params.add(query.status)}`);

    const fromSql = `
      FROM billing.donations
      WHERE ${where.join(" AND ")}
    `;

    const page = await paginateFrom<QueryResultRow>(this.db, fromSql, params.values, {
      select: `
        id,
        user_id,
        donation_type,
        amount_minor,
        currency,
        status,
        provider,
        provider_session_id,
        provider_customer_id,
        provider_subscription_id,
        current_period_start,
        current_period_end,
        canceled_at,
        created_at,
        updated_at
      `,
      orderMap: {
        createdAt: "created_at",
        updatedAt: "updated_at",
        amountMinor: "amount_minor",
      },
      orderBy: query.orderBy ?? "createdAt",
      orderDir: query.orderDir ?? "desc",
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });

    return {
      rows: page.rows.map((row) => this.mapRow(row)),
      total: page.total,
    };
  }

  private amountToEurMinor(
    amountMinor: number,
    currency: string,
    ratesToEur: Record<string, number>,
  ): number {
    const rate = ratesToEur[currency.toUpperCase()];
    if (!rate) return amountMinor;
    const eur = (amountMinor / DonationRepo.EUR_MINOR_UNITS) * rate;
    return Math.round(eur * DonationRepo.EUR_MINOR_UNITS);
  }

  private async getLatestRatesToEur(currencies: string[]): Promise<Record<string, number>> {
    const normalized = Array.from(
      new Set(
        currencies.map((value) => value.trim().toUpperCase()).filter((value) => value.length === 3),
      ),
    );

    if (normalized.length === 0) {
      return { EUR: 1 };
    }

    const query = await this.db.query<{ currency: string; rate_to_eur: string | number }>(
      `
      SELECT DISTINCT ON (currency)
        currency,
        rate_to_eur
      FROM billing.fx_rates_daily
      WHERE currency = ANY($1::char(3)[])
      ORDER BY currency, rate_date DESC
      `,
      [normalized],
    );

    const rates: Record<string, number> = { EUR: 1 };
    for (const row of query.rows) {
      const currency = String(row.currency).trim().toUpperCase();
      const rate = Number(row.rate_to_eur);
      if (currency && Number.isFinite(rate) && rate > 0) {
        rates[currency] = rate;
      }
    }

    return rates;
  }

  private calculateMonthsSince(start: Date, end: Date): number {
    if (end <= start) return 1;
    const startYearMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const endYearMonth = end.getUTCFullYear() * 12 + end.getUTCMonth();
    const months = endYearMonth - startYearMonth + 1;
    return Math.max(1, months);
  }

  private resolveBadgeProgress(
    currentValue: number,
    thresholds: number[],
  ): SupporterBadgeBranchProgress {
    let level = 0;
    for (const threshold of thresholds) {
      if (currentValue >= threshold) level += 1;
    }

    const nextLevel = level >= thresholds.length ? null : level + 1;
    const nextThreshold = nextLevel ? thresholds[nextLevel - 1] : null;

    return {
      level,
      maxLevel: thresholds.length,
      nextLevel,
      nextThreshold,
    };
  }

  async getSupporterProgress(userId: string): Promise<SupporterProgress> {
    const query = await this.db.query<{
      donation_type: "one_time" | "monthly";
      amount_minor: number;
      currency: string;
      status: "active" | "completed" | "canceled";
      current_period_start: Date | null;
      current_period_end: Date | null;
      canceled_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      SELECT
        donation_type,
        amount_minor,
        currency,
        status,
        current_period_start,
        current_period_end,
        canceled_at,
        created_at,
        updated_at
      FROM billing.donations
      WHERE
        is_archived = false
        AND user_id = $1
        AND (
          (donation_type = 'one_time' AND status = 'completed')
          OR
          (donation_type = 'monthly' AND status IN ('active', 'completed', 'canceled'))
        )
      `,
      [userId],
    );

    const ratesToEur = await this.getLatestRatesToEur(query.rows.map((row) => row.currency));

    let totalDonatedEurMinor = 0;
    let monthlySupportingMonths = 0;
    const now = new Date();

    for (const row of query.rows) {
      if (row.donation_type === "one_time") {
        totalDonatedEurMinor += this.amountToEurMinor(row.amount_minor, row.currency, ratesToEur);
        continue;
      }

      const monthlyStart = row.current_period_start ?? row.created_at;
      const monthlyEnd =
        row.status === "active"
          ? now
          : (row.canceled_at ?? row.current_period_end ?? row.updated_at ?? row.created_at);
      const months = this.calculateMonthsSince(monthlyStart, monthlyEnd);
      monthlySupportingMonths += months;

      const eurPerMonthMinor = this.amountToEurMinor(row.amount_minor, row.currency, ratesToEur);
      totalDonatedEurMinor += eurPerMonthMinor * months;
    }

    const amountBranch = this.resolveBadgeProgress(
      totalDonatedEurMinor,
      DonationRepo.AMOUNT_BADGE_THRESHOLDS_EUR_MINOR,
    );
    const monthlyBranch = this.resolveBadgeProgress(
      monthlySupportingMonths,
      DonationRepo.MONTHLY_BADGE_THRESHOLDS_MONTHS,
    );

    const unlockedBadges: string[] = [];
    for (let i = 1; i <= amountBranch.level; i += 1) {
      unlockedBadges.push(`amount_l${i}`);
    }
    for (let i = 1; i <= monthlyBranch.level; i += 1) {
      unlockedBadges.push(`months_l${i}`);
    }

    return {
      totalDonatedEurMinor,
      monthlySupportingMonths,
      unlockedBadges,
      amountBranch,
      monthlyBranch,
    };
  }
}
