import { Suspense } from "react";
import ApiKeyRotationReviewClient from "./ApiKeyRotationReviewClient";

export default function ApiKeyRotationReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
          Loading…
        </div>
      }
    >
      <ApiKeyRotationReviewClient />
    </Suspense>
  );
}
