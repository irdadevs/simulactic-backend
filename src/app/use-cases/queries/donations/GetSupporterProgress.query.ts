import { IDonation, SupporterProgress } from "../../../interfaces/Donation.port";

export class GetSupporterProgress {
  constructor(private readonly donationRepo: IDonation) {}

  async execute(userId: string): Promise<SupporterProgress> {
    return this.donationRepo.refreshSupporterProgress(userId);
  }
}
