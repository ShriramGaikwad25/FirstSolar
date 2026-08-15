import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Continuous Compliance - Secret Unused Over 120 Days",
};

export default function SecretInactivityReviewLayout({ children }: { children: ReactNode }) {
  return children;
}
