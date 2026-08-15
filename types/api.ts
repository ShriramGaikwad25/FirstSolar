export interface PaginatedResponse<T> {
  current_page: number;
  has_next: boolean;
  has_previous: boolean;
  items: T[];
  next_page: number;
  page_size: number;
  previous_page: number;
  total_items: number;
  total_pages: number;
}

export interface CertAnalytics {
  inactiveaccount_count: number;
  dormant_count: number;
  highriskentitlement_count: number;
  violations_count: number;
  orphan_count: number;
  newaccount_count: number;
  newaccess_count: number;
  inactiveuser_count: number;
  highriskaccount_count: number;
}

export interface CertAnalyticsResponse {
  analytics: Record<string, CertAnalytics>;
  executionStatus: string;
  errorMessage: string;
}