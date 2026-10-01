import { Suspense } from "react";
import ViolationsPageClient from "./ViolationsPageClient";

export default function ViolationsPage() {
  // Filters live in the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading…</div>}>
      <ViolationsPageClient />
    </Suspense>
  );
}
