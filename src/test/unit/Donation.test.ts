import { Donation } from "../../domain/aggregates/Donation";
import { DonationCacheService } from "../../app/app-services/donations/DonationCache.service";
import { IDonation, SupporterProgress } from "../../app/interfaces/Donation.port";
import {
  IPaymentGateway,
  PaymentSessionResult,
  RetrievedCheckoutSession,
} from "../../app/interfaces/PaymentGateway.port";
import { CreateDonationCheckout } from "../../app/use-cases/commands/donations/CreateDonationCheckout.command";
import { CreateCustomerPortalSession } from "../../app/use-cases/commands/donations/CreateCustomerPortalSession.command";
import { ConfirmDonationBySession } from "../../app/use-cases/commands/donations/ConfirmDonationBySession.command";
import { CancelDonation } from "../../app/use-cases/commands/donations/CancelDonation.command";

const assertErrorCode = async (fn: () => Promise<unknown>, code: string): Promise<void> => {
  let thrown: unknown;
  try {
    await fn();
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeDefined();
  expect((thrown as { code?: string }).code).toBe(code);
};

const emptyProgress: SupporterProgress = {
  totalDonatedEurMinor: 0,
  monthlySupportingMonths: 0,
  unlockedBadges: [],
  amountBranch: {
    level: 0,
    maxLevel: 6,
    nextLevel: 1,
    nextThreshold: 500,
    currentBadge: null,
    nextBadge: {
      branch: "amount" as const,
      level: 1,
      name: "Bronze Patron",
      quantityLabel: "5 EUR",
      threshold: 500,
    },
  },
  monthlyBranch: {
    level: 0,
    maxLevel: 7,
    nextLevel: 1,
    nextThreshold: 1,
    currentBadge: null,
    nextBadge: {
      branch: "months" as const,
      level: 1,
      name: "Monthly Initiate",
      quantityLabel: "1 month",
      threshold: 1,
    },
  },
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Donation aggregate", () => {
  it("creates one-time donation", () => {
    const donation = Donation.create({
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "one_time",
      amountMinor: 2500,
      currency: "eur",
      providerSessionId: "cs_123",
    });

    expect(donation.donationType).toBe("one_time");
    expect(donation.amountMinor).toBe(2500);
    expect(donation.currency).toBe("EUR");
    expect(donation.status).toBe("pending");
  });

  it("activates recurring donation lifecycle", () => {
    const donation = Donation.create({
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "monthly",
      amountMinor: 999,
      currency: "USD",
      providerSessionId: "cs_monthly",
    });

    donation.activateRecurring({
      providerSubscriptionId: "sub_123",
      providerCustomerId: "cus_123",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(donation.status).toBe("active");
    expect(donation.providerSubscriptionId).toBe("sub_123");
    expect(donation.providerCustomerId).toBe("cus_123");
  });

  it("fails on invalid amount", () => {
    expect(() =>
      Donation.create({
        userId: "11111111-1111-4111-8111-111111111111",
        donationType: "one_time",
        amountMinor: 0,
        currency: "USD",
        providerSessionId: "cs_bad",
      }),
    ).toThrow();
  });
});

describe("Donation commands", () => {
  it("creates checkout and stores pending donation", async () => {
    const saveSpy = jest.fn<Promise<Donation>, [Donation]>(async (donation) => donation);
    const invalidateSpy = jest.fn<Promise<void>, [Donation]>(async () => undefined);
    const createSessionSpy = jest.fn<
      Promise<PaymentSessionResult>,
      [
        {
          donationType: "one_time" | "monthly";
          amountMinor: number;
          currency: string;
          successUrl: string;
          cancelUrl: string;
          customerEmail?: string;
          metadata?: Record<string, string>;
        },
      ]
    >(async () => ({
      sessionId: "cs_test_1",
      url: "https://checkout.stripe.com/pay/cs_test_1",
    }));

    const repo: IDonation = {
      save: saveSpy,
      findById: async (_id: string): Promise<Donation | null> => null,
      findByProviderSessionId: async (_sessionId: string): Promise<Donation | null> => null,
      list: async (_query): Promise<{ rows: Donation[]; total: number }> => ({
        rows: [],
        total: 0,
      }),
      listSupporterBadges: async () => ({ rows: [], total: 0 }),
      getSupporterProgress: async (_userId: string) => emptyProgress,
      refreshSupporterProgress: async (_userId: string) => emptyProgress,
    };

    const gateway: IPaymentGateway = {
      createCheckoutSession: createSessionSpy,
      retrieveCheckoutSession: async (_sessionId: string): Promise<RetrievedCheckoutSession> => ({
        sessionId: "cs_test_1",
        status: "open",
        paymentStatus: "unpaid",
        customerId: null,
        subscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      cancelSubscription: async (_subscriptionId: string): Promise<void> => undefined,
      createCustomerPortalSession: async (): Promise<{ url: string }> => ({
        url: "https://billing.stripe.com/p/session_test",
      }),
    };

    const cache = {
      invalidateForMutation: invalidateSpy,
    } as unknown as DonationCacheService;

    const command = new CreateDonationCheckout(repo, gateway, cache);
    const result = await command.execute({
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "one_time",
      amountMinor: 2000,
      currency: "USD",
      successUrl: "https://app.local/success",
      cancelUrl: "https://app.local/cancel",
      customerEmail: "user@test.com",
    });

    expect(result.sessionId).toBe("cs_test_1");
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("confirms monthly donation by checkout session", async () => {
    const donation = Donation.create({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "monthly",
      amountMinor: 999,
      currency: "USD",
      providerSessionId: "cs_monthly",
      status: "pending",
    });

    const saveSpy = jest.fn<Promise<Donation>, [Donation]>(async (updated) => updated);
    const invalidateSpy = jest.fn<Promise<void>, [Donation]>(async () => undefined);

    const repo: IDonation = {
      save: saveSpy,
      findById: async (_id: string): Promise<Donation | null> => donation,
      findByProviderSessionId: async (_sessionId: string): Promise<Donation | null> => donation,
      list: async (_query): Promise<{ rows: Donation[]; total: number }> => ({
        rows: [],
        total: 0,
      }),
      listSupporterBadges: async () => ({ rows: [], total: 0 }),
      getSupporterProgress: async (_userId: string) => emptyProgress,
      refreshSupporterProgress: async (_userId: string) => ({
        ...emptyProgress,
        totalDonatedEurMinor: 999,
        monthlySupportingMonths: 1,
      }),
    };

    const gateway: IPaymentGateway = {
      createCheckoutSession: async (_params): Promise<PaymentSessionResult> => ({
        sessionId: "cs_unused",
        url: "https://checkout.stripe.com/pay/cs_unused",
      }),
      retrieveCheckoutSession: async (_sessionId: string): Promise<RetrievedCheckoutSession> => ({
        sessionId: "cs_monthly",
        status: "complete",
        paymentStatus: "paid",
        customerId: "cus_123",
        subscriptionId: "sub_123",
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      }),
      cancelSubscription: async (_subscriptionId: string): Promise<void> => undefined,
      createCustomerPortalSession: async (): Promise<{ url: string }> => ({
        url: "https://billing.stripe.com/p/session_test",
      }),
    };

    const cache = {
      invalidateForMutation: invalidateSpy,
    } as unknown as DonationCacheService;
    const user = {
      isSupporter: false,
      supporterFrom: null as Date | null,
      markSupporter: jest.fn<void, []>(() => {
        user.isSupporter = true;
        user.supporterFrom = new Date("2026-01-01T00:00:00.000Z");
      }),
    };
    const userRepo = {
      findById: jest.fn<Promise<typeof user>, []>(async () => user),
      save: jest.fn<Promise<typeof user>, [unknown]>(async () => user),
    };
    const userCache = {
      setUser: jest.fn<Promise<void>, [unknown]>(async () => undefined),
    };

    const command = new ConfirmDonationBySession(
      repo,
      gateway,
      cache,
      userRepo as any,
      userCache as any,
    );
    await command.execute("cs_monthly");

    expect(donation.status).toBe("active");
    expect(donation.providerSubscriptionId).toBe("sub_123");
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(user.markSupporter).toHaveBeenCalledTimes(1);
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });

  it("cancels active monthly donation", async () => {
    const donation = Donation.create({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "monthly",
      amountMinor: 500,
      currency: "USD",
      providerSessionId: "cs_cancel",
      providerSubscriptionId: "sub_cancel",
      status: "active",
    });

    const saveSpy = jest.fn<Promise<Donation>, [Donation]>(async (updated) => updated);
    const cancelSubscriptionSpy = jest.fn<Promise<void>, [string]>(async () => undefined);

    const repo: IDonation = {
      save: saveSpy,
      findById: async (_id: string): Promise<Donation | null> => donation,
      findByProviderSessionId: async (_sessionId: string): Promise<Donation | null> => null,
      list: async (_query): Promise<{ rows: Donation[]; total: number }> => ({
        rows: [],
        total: 0,
      }),
      listSupporterBadges: async () => ({ rows: [], total: 0 }),
      getSupporterProgress: async (_userId: string) => emptyProgress,
      refreshSupporterProgress: async (_userId: string) => emptyProgress,
    };

    const gateway: IPaymentGateway = {
      createCheckoutSession: async (_params): Promise<PaymentSessionResult> => ({
        sessionId: "cs_unused",
        url: "https://checkout.stripe.com/pay/cs_unused",
      }),
      retrieveCheckoutSession: async (_sessionId: string): Promise<RetrievedCheckoutSession> => ({
        sessionId: "cs_unused",
        status: "open",
        paymentStatus: "unpaid",
        customerId: null,
        subscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      cancelSubscription: cancelSubscriptionSpy,
      createCustomerPortalSession: async (): Promise<{ url: string }> => ({
        url: "https://billing.stripe.com/p/session_test",
      }),
    };

    const cache = {
      invalidateForMutation: jest.fn<Promise<void>, [Donation]>(async () => undefined),
    } as unknown as DonationCacheService;

    const command = new CancelDonation(repo, gateway, cache);
    await command.execute(donation.id);

    expect(cancelSubscriptionSpy).toHaveBeenCalledWith("sub_cancel");
    expect(donation.status).toBe("canceled");
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects cancel for non-recurring donation", async () => {
    const donation = Donation.create({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "one_time",
      amountMinor: 1500,
      currency: "USD",
      providerSessionId: "cs_one_time",
      status: "completed",
    });

    const repo: IDonation = {
      save: async (updated: Donation): Promise<Donation> => updated,
      findById: async (_id: string): Promise<Donation | null> => donation,
      findByProviderSessionId: async (_sessionId: string): Promise<Donation | null> => null,
      list: async (_query): Promise<{ rows: Donation[]; total: number }> => ({
        rows: [],
        total: 0,
      }),
      listSupporterBadges: async () => ({ rows: [], total: 0 }),
      getSupporterProgress: async (_userId: string) => emptyProgress,
      refreshSupporterProgress: async (_userId: string) => emptyProgress,
    };

    const gateway: IPaymentGateway = {
      createCheckoutSession: async (_params): Promise<PaymentSessionResult> => ({
        sessionId: "cs_unused",
        url: "https://checkout.stripe.com/pay/cs_unused",
      }),
      retrieveCheckoutSession: async (_sessionId: string): Promise<RetrievedCheckoutSession> => ({
        sessionId: "cs_unused",
        status: "open",
        paymentStatus: "unpaid",
        customerId: null,
        subscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      cancelSubscription: async (_subscriptionId: string): Promise<void> => undefined,
      createCustomerPortalSession: async (): Promise<{ url: string }> => ({
        url: "https://billing.stripe.com/p/session_test",
      }),
    };

    const cache = {
      invalidateForMutation: jest.fn<Promise<void>, [Donation]>(async () => undefined),
    } as unknown as DonationCacheService;

    const command = new CancelDonation(repo, gateway, cache);
    await assertErrorCode(async () => command.execute(donation.id), "PRESENTATION.INVALID_FIELD");
  });

  it("creates a Stripe customer portal session for recurring donations with a customer id", async () => {
    const donation = Donation.create({
      id: "abababab-abab-4bab-8bab-abababababab",
      userId: "11111111-1111-4111-8111-111111111111",
      donationType: "monthly",
      amountMinor: 999,
      currency: "USD",
      providerSessionId: "cs_portal",
      providerCustomerId: "cus_portal_123",
      status: "active",
    });

    const createPortalSpy = jest.fn<
      Promise<{ url: string }>,
      [{ customerId: string; returnUrl: string }]
    >(async () => ({
      url: "https://billing.stripe.com/p/session_portal",
    }));

    const gateway: IPaymentGateway = {
      createCheckoutSession: async (): Promise<PaymentSessionResult> => ({
        sessionId: "cs_unused",
        url: "https://checkout.stripe.com/pay/cs_unused",
      }),
      retrieveCheckoutSession: async (): Promise<RetrievedCheckoutSession> => ({
        sessionId: "cs_unused",
        status: "open",
        paymentStatus: "unpaid",
        customerId: null,
        subscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
      cancelSubscription: async (): Promise<void> => undefined,
      createCustomerPortalSession: createPortalSpy,
    };

    const command = new CreateCustomerPortalSession(gateway);
    const result = await command.execute(donation, {
      returnUrl: "https://app.local/dashboard",
    });

    expect(result.url).toBe("https://billing.stripe.com/p/session_portal");
    expect(createPortalSpy).toHaveBeenCalledWith({
      customerId: "cus_portal_123",
      returnUrl: "https://app.local/dashboard",
    });
  });
});
