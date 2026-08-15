import { Suspense } from "react";
import TenantPosturePage from "@/components/oci-policy-risk-management/TenantPosturePage";

export default function Page() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-gray-600">Loading…</div>}>
      <TenantPosturePage />
    </Suspense>
  );
}
