import { IDonation, SupporterBadgeDefinition } from "../../../interfaces/Donation.port";

export class ListSupporterBadges {
  constructor(private readonly donationRepo: IDonation) {}

  async execute(): Promise<{ rows: SupporterBadgeDefinition[]; total: number }> {
    return this.donationRepo.listSupporterBadges();
  }
}
