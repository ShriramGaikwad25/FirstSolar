import { Suspense } from "react";
import RiskRemediationPage from "@/components/oci-policy-risk-management/RiskRemediationPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-gray-600">Loading…</div>}>
      <RiskRemediationPage />
    </Suspense>
  );
}
