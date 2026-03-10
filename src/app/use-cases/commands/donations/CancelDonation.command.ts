import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { DonationCacheService } from "../../../app-services/donations/DonationCache.service";
import { IDonation } from "../../../interfaces/Donation.port";
import { IPaymentGateway } from "../../../interfaces/PaymentGateway.port";

export class CancelDonation {
  constructor(
    private readonly donationRepo: IDonation,
    private readonly paymentGateway: IPaymentGateway,
    private readonly donationCache: DonationCacheService,
  ) {}

  async execute(id: string): Promise<void> {
    const donation = await this.donationRepo.findById(id);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id,
      });
    }

    if (donation.donationType !== "monthly" || !donation.providerSubscriptionId) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", {
        field: "donationType",
      });
    }

    await this.paymentGateway.cancelSubscription(donation.providerSubscriptionId);
    donation.cancel();
    const saved = await this.donationRepo.save(donation);
    await this.donationCache.invalidateForMutation(saved);
    await this.donationRepo.refreshSupporterProgress(saved.userId);
  }
}
