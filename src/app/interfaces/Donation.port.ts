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

export type SupporterBadgeBranch = "amount" | "months";

export type SupporterBadgeLevel = {
  level: number;
  branch: SupporterBadgeBranch;
  name: string;
  quantityLabel: string;
  threshold: number;
};

export type SupporterBadgeDefinition = SupporterBadgeLevel & {
  id: number;
};

export type SupporterUnlockedBadge = SupporterBadgeLevel & {
  unlockedAt: Date;
};

export type SupporterBadgeBranchProgress = {
  level: number;
  maxLevel: number;
  nextLevel: number | null;
  nextThreshold: number | null;
  currentBadge: SupporterBadgeLevel | null;
  nextBadge: SupporterBadgeLevel | null;
};

export type SupporterProgress = {
  totalDonatedEurMinor: number;
  monthlySupportingMonths: number;
  unlockedBadges: SupporterUnlockedBadge[];
  amountBranch: SupporterBadgeBranchProgress;
  monthlyBranch: SupporterBadgeBranchProgress;
  updatedAt: Date | null;
};

export interface IDonation {
  save(donation: Donation): Promise<Donation>;
  findById(id: string): Promise<Donation | null>;
  findByProviderSessionId(sessionId: string): Promise<Donation | null>;
  findByProviderSubscriptionId(subscriptionId: string): Promise<Donation | null>;
  findLatestByUserIdWithProviderCustomerId(userId: string): Promise<Donation | null>;
  list(query: ListDonationsQuery): Promise<{ rows: Donation[]; total: number }>;
  listSupporterBadges(): Promise<{ rows: SupporterBadgeDefinition[]; total: number }>;
  getSupporterProgress(userId: string): Promise<SupporterProgress>;
  refreshSupporterProgress(userId: string): Promise<SupporterProgress>;
}
