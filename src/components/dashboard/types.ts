export interface DashboardStats {
  totalGenerated: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  lessons: number;
  ingestedPosts: number;
  hasCompanyInfo: boolean;
  hasStyleProfile: boolean;
}
