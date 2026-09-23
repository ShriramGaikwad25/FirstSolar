/**
 * Tailwind class sets for access-request / approval status pills (Track requests, My Approvals).
 */
export function getAccessRequestStatusBadgeClasses(status: string): string {
  const s = String(status ?? "").trim().toLowerCase();

  if (s.includes("reject") || s.includes("denied")) {
    return "bg-red-100 text-red-700";
  }
  if (s.includes("fail") || s.includes("error")) {
    return "bg-orange-100 text-orange-700";
  }
  if (s.includes("approv") || s.includes("complet") || s.includes("grant") || s.includes("success")) {
    // "Pending Approval" contains "approv" too, so exclude pending/awaiting explicitly first below.
    if (!s.includes("pending") && !s.includes("awaiting")) {
      return "bg-green-100 text-green-700";
    }
  }
  if (s.includes("provide information") || s.includes("info requested") || s.includes("information requested")) {
    return "bg-purple-100 text-purple-700";
  }
  if (s.includes("withdraw") || s.includes("cancel")) {
    return "bg-gray-100 text-gray-600";
  }

  return "bg-blue-100 text-blue-700";
}
