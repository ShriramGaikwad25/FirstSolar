import { Suspense } from "react";
import GuardrailsPage from "@/components/oci-policy-risk-management/GuardrailsPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-gray-600">Loading…</div>}>
      <GuardrailsPage />
    </Suspense>
  );
}
