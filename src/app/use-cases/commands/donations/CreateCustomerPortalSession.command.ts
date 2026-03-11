import { Donation } from "../../../../domain/aggregates/Donation";
import { CreateCustomerPortalSessionDTO } from "../../../../presentation/security/donations/CreateCustomerPortalSession.dto";
import { ErrorFactory } from "../../../../utils/errors/Error.map";
import { IPaymentGateway } from "../../../interfaces/PaymentGateway.port";

export class CreateCustomerPortalSession {
  constructor(private readonly paymentGateway: IPaymentGateway) {}

  async execute(donation: Donation, dto: CreateCustomerPortalSessionDTO): Promise<{ url: string }> {
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
