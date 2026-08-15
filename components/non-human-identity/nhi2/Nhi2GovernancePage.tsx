"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";
import { Nhi2PageIntro, Nhi2Tabs } from "@/components/non-human-identity/nhi2/Nhi2Tabs";
import { FindingsPage } from "@/components/non-human-identity/FindingsPage";
import { SodViolationsPage } from "@/components/non-human-identity/SodViolationsPage";
import { ChangesPage } from "@/components/non-human-identity/ChangesPage";
import { ReviewsPage } from "@/components/non-human-identity/ReviewsPage";
import { ControlRunsPage } from "@/components/non-human-identity/ControlRunsPage";
import { RotationPolicyListPage } from "@/components/non-human-identity/RotationPolicyListPage";

const TABS = [
  { key: "findings", label: "Findings" },
  { key: "sod", label: "SoD" },
  { key: "changes", label: "Change requests" },
  { key: "reviews", label: "Reviews" },
  { key: "controls", label: "Controls" },
  { key: "rotation", label: "Rotation policies" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Nhi2GovernanceContent() {
  const searchParams = useSearchParams();
  const initial =
    TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "findings";
  const [tab, setTab] = useState<TabKey>(initial);

  const pickTab = (key: string) => {
    setTab(key as TabKey);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <div className={NHI2_PAGE_SHELL_CLASS}>
      <Nhi2PageIntro
        title="Governance"
        description="Audit, compliance and workflow surfaces — open findings, segregation of duties, provisioning workflow, periodic reviews, and control runs."
      />
      <Nhi2Tabs tabs={[...TABS]} active={tab} onChange={pickTab} />
      {tab === "findings" && <FindingsPage apiMode="v2" />}
      {tab === "sod" && <SodViolationsPage apiMode="v2" />}
      {tab === "changes" && <ChangesPage apiMode="v2" />}
      {tab === "reviews" && <ReviewsPage apiMode="v2" />}
      {tab === "controls" && <ControlRunsPage apiMode="v2" />}
      {tab === "rotation" && <RotationPolicyListPage apiMode="v2" />}
    </div>
  );
}

export function Nhi2GovernancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <Nhi2GovernanceContent />
    </Suspense>
  );
}
