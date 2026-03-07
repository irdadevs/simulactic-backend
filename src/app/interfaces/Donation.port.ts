import { Donation, DonationStatus, DonationType } from "../../domain/aggregates/Donation";

export type ListDonationsQuery = {
  userId?: string;
  donationType?: DonationType;
  status?: DonationStatus;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "amountMinor";
  orderDir?: "asc" | "desc";
};

export type SupporterBadgeBranchProgress = {
  level: number;
  maxLevel: number;
  nextLevel: number | null;
  nextThreshold: number | null;
};

export type SupporterProgress = {
  totalDonatedEurMinor: number;
  monthlySupportingMonths: number;
  unlockedBadges: string[];
  amountBranch: SupporterBadgeBranchProgress;
  monthlyBranch: SupporterBadgeBranchProgress;
};

export interface IDonation {
  save(donation: Donation): Promise<Donation>;
  findById(id: string): Promise<Donation | null>;
  findByProviderSessionId(sessionId: string): Promise<Donation | null>;
  list(query: ListDonationsQuery): Promise<{ rows: Donation[]; total: number }>;
  getSupporterProgress(userId: string): Promise<SupporterProgress>;
}
