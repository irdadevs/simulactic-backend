import { CreateCustomerPortalSessionDTO } from "../../../../presentation/security/donations/CreateCustomerPortalSession.dto";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { IDonation } from "../../../interfaces/Donation.port";
import { IPaymentGateway } from "../../../interfaces/PaymentGateway.port";

export class CreateCustomerPortalSession {
  constructor(
    private readonly donationRepo: IDonation,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(userId: string, dto: CreateCustomerPortalSessionDTO): Promise<{ url: string }> {
    console.log("[DONATION.PORTAL] resolving customer context", {
      userId,
      returnUrl: dto.returnUrl,
    });

    const donation = await this.donationRepo.findLatestByUserIdWithProviderCustomerId(userId);
    if (!donation) {
      console.log("[DONATION.PORTAL] no donation with provider customer id found", { userId });
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: userId,
      });
    }

    console.log("[DONATION.PORTAL] donation resolved", {
      donationId: donation.id,
      donationStatus: donation.status,
      providerCustomerId: donation.providerCustomerId,
      providerSubscriptionId: donation.providerSubscriptionId,
    });

    if (!donation.providerCustomerId) {
      console.log("[DONATION.PORTAL] donation missing providerCustomerId", {
        donationId: donation.id,
      });
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", {
        field: "providerCustomerId",
      });
    }

    console.log("[DONATION.PORTAL] creating stripe portal session", {
      customerId: donation.providerCustomerId,
      returnUrl: dto.returnUrl,
    });

    return this.paymentGateway.createCustomerPortalSession({
      customerId: donation.providerCustomerId,
      returnUrl: dto.returnUrl,
    });
  }
}
