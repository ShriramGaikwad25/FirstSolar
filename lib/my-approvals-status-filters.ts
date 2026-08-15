/** Status values used by My Approvals filter dropdown (and shared Track requests filter). */

export type PendingApprovalStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Info Requested";

export type MyApprovalsStatusFilter = "All" | PendingApprovalStatus;

export const MY_APPROVALS_STATUS_SELECT_OPTIONS: {
  value: MyApprovalsStatusFilter;
  label: string;
}[] = [
  { value: "All", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Info Requested", label: "Info Requested" },
];

/**
 * Maps access-request / track-request API status strings into the same buckets as My Approvals.
 */
export function mapAccessRequestStatusToMyApprovalsFilter(
  status: string
): PendingApprovalStatus {
  const s = status.trim().toLowerCase();

  const exact = (
    ["Pending", "Approved", "Rejected", "Info Requested"] as const
  ).find((bucket) => bucket.toLowerCase() === s);
  if (exact) return exact;

  if (s.includes("reject") || s.includes("denied")) return "Rejected";
  if (s.includes("provide information") || s.includes("info requested")) {
    return "Info Requested";
  }
  if (s.includes("approved") || s.includes("completed")) return "Approved";
  return "Pending";
}
