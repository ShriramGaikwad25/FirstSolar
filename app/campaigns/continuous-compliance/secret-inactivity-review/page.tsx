import { Suspense } from "react";
import SecretInactivityReviewClient from "./SecretInactivityReviewClient";

export default function SecretInactivityReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
          Loading…
        </div>
      }
    >
      <SecretInactivityReviewClient />
    </Suspense>
  );
}
