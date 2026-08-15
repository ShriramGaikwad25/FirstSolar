"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NHI2_PAGE_SHELL_CLASS } from "@/lib/nhi-shell";
import { Nhi2PageIntro, Nhi2Tabs } from "@/components/non-human-identity/nhi2/Nhi2Tabs";
import { LookupCatalogPage } from "@/components/non-human-identity/LookupCatalogPage";

const TABS = [
  { key: "lookups", label: "Lookups" },
  { key: "onboarding", label: "App Onboarding" },
  { key: "integrations", label: "Integrations" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function PlaceholderTab({
  title,
  blurb,
  bulletPoints,
}: {
  title: string;
  blurb: string;
  bulletPoints: string[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">{blurb}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {bulletPoints.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function Nhi2AdminContent() {
  const searchParams = useSearchParams();
  const initial = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "lookups";
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
        title="Admin"
        description="Configuration surfaces — lookup catalogues, application onboarding, and external system integrations."
      />
      <Nhi2Tabs tabs={[...TABS]} active={tab} onChange={pickTab} />
      {tab === "lookups" && <LookupCatalogPage apiMode="v2" />}
      {tab === "onboarding" && (
        <PlaceholderTab
          title="Application Onboarding"
          blurb="Register a new application instance, wire its adapter, set the SCIM matching attribute, and seed default ownership assignments."
          bulletPoints={[
            "New applicationinstance row + appid",
            "Pick + configure system_adapter (SAP S/4, AAD, AWS, …)",
            "Set scimMatchAttribute / identityMatchingAttribute",
            "Seed default owners and SoD scope",
          ]}
        />
      )}
      {tab === "integrations" && (
        <PlaceholderTab
          title="Integrations"
          blurb="External system connectors — vault providers, SCIM bridges, IdP / OIDC, and SaaS event sources."
          bulletPoints={[
            "Vault providers (Hashicorp / AWS SM / Azure KV / CyberArk / Akeyless / …)",
            "SCIM inbound / outbound bridges",
            "OIDC / SAML IdP connectors",
            "SaaS event sources (ServiceNow, Jira, …)",
          ]}
        />
      )}
    </div>
  );
}

export function Nhi2AdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <Nhi2AdminContent />
    </Suspense>
  );
}
