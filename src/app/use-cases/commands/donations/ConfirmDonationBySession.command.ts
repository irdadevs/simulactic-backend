import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { Uuid } from "../../../../domain/aggregates/User";
import { UserCacheService } from "../../../app-services/users/UserCache.service";
import { DonationCacheService } from "../../../app-services/donations/DonationCache.service";
import { IDonation } from "../../../interfaces/Donation.port";
import { IPaymentGateway } from "../../../interfaces/PaymentGateway.port";
import { IUser } from "../../../interfaces/User.port";

export class ConfirmDonationBySession {
  constructor(
    private readonly donationRepo: IDonation,
    private readonly paymentGateway: IPaymentGateway,
    private readonly donationCache: DonationCacheService,
    private readonly userRepo: IUser,
    private readonly userCache?: UserCacheService,
  ) {}

  async execute(sessionId: string): Promise<void> {
    const donation = await this.donationRepo.findByProviderSessionId(sessionId);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: sessionId,
      });
    }

    const session = await this.paymentGateway.retrieveCheckoutSession(sessionId);

    console.log("[DONATION] session payload =", session);

    if (session.status === "expired") {
      donation.expire();
    } else if (donation.donationType === "one_time") {
      if (session.paymentStatus === "paid") donation.completeOneTime();
      else donation.fail();
    } else {
      console.log("[DONATION] recurring session fields", {
        customerId: session.customerId,
        subscriptionId: session.subscriptionId,
        currentPeriodStart: session.currentPeriodStart,
        currentPeriodEnd: session.currentPeriodEnd,
        status: session.status,
        paymentStatus: session.paymentStatus,
      });
      if (
        !session.customerId ||
        !session.subscriptionId ||
        !session.currentPeriodStart ||
        !session.currentPeriodEnd
      ) {
        throw ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
          cause: "Stripe recurring checkout confirmed but subscription period data is incomplete",
        });
      }
      if (session.subscriptionId && session.status === "complete") {
        donation.activateRecurring({
          providerCustomerId: session.customerId,
          providerSubscriptionId: session.subscriptionId,
          currentPeriodStart: session.currentPeriodStart,
          currentPeriodEnd: session.currentPeriodEnd,
        });
      } else {
        donation.fail();
      }
    }

    const saved = await this.donationRepo.save(donation);
    await this.donationCache.invalidateForMutation(saved);

    await this.donationRepo.refreshSupporterProgress(saved.userId);

    if (saved.status === "active" || saved.status === "completed") {
      const user = await this.userRepo.findById(Uuid.create(saved.userId));
      if (user && !user.isSupporter) {
        user.markSupporter();
        const savedUser = await this.userRepo.save(user);
        if (this.userCache) {
          await this.userCache.setUser(savedUser);
        }
      }
    }
  }
}
