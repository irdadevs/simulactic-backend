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
    const donation = await this.donationRepo.findLatestByUserIdWithProviderCustomerId(userId);
    if (!donation) {
      throw ErrorFactory.presentation("SHARED.NOT_FOUND", {
        sourceType: "donation",
        id: userId,
      });
    }

    if (!donation.providerCustomerId) {
      throw ErrorFactory.presentation("PRESENTATION.INVALID_FIELD", {
        field: "providerCustomerId",
      });
    }

    return this.paymentGateway.createCustomerPortalSession({
      customerId: donation.providerCustomerId,
      returnUrl: dto.returnUrl,
    });
  }
}
