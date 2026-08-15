import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Continuous Compliance - API Key Overdue Rotation",
};

export default function ApiKeyRotationReviewLayout({ children }: { children: ReactNode }) {
  return children;
}
