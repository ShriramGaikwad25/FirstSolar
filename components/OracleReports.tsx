"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock4,
  UserX,
  FileClock,
  UserMinus,
  Users,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import DashboardCard from "@/components/DashboardCard";
import Tabs from "@/components/tabs";
import type { LucideIcon } from "lucide-react";

type ReportCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  flipDescription?: string;
};

const REPORT_CARDS: ReportCard[] = [
  {
    title: "Access Request Summary Report",
    description:
      "Aggregates access requests, approvals, and rejections related to applications to support compliance reviews.",
    icon: ClipboardList,
    href: "/oracle-reports/access-request-report",
  },
  {
    title: "Last Login Report - Application",
    description:
      "Highlights last-login timestamps for target application accounts to help spot inactive or stale access.",
    icon: Clock4,
    href: "/oracle-reports/target-application-last-logon-report",
  },
  {
    title: "Deleted Application Accounts Report",
    description:
      "Summarizes accounts deleted in target applications so you can validate deprovisioning and audit trails.",
    icon: UserX,
    href: "/oracle-reports/deleted-target-application-accounts",
  },
  {
    title: "User Access History Report",
    description:
      "Provides a chronological view of user access changes across applications for investigations and audits.",
    icon: FileClock,
    href: "/oracle-reports/user-access-history-report",
  },
  {
    title: "Orphan Account Report",
    description:
      "Shows accounts that are no longer linked to active identities, helping you detect and remediate orphaned access.",
    icon: UserMinus,
    href: "/oracle-reports/orphan-account",
  },
  {
    title: "User Current Access Report",
    description:
      "Summarizes current user access across applications to support reviews and certifications.",
    icon: Users,
    href: "/oracle-reports/user-access-report",
  },
  {
    title: "Policies Report",
    description:
      "Lists access and security policies to help you analyze configured controls and their impact.",
    icon: ShieldCheck,
    href: "/oracle-reports/policies-report",
  },
  {
    title: "SOD Violation Report",
    description:
      "Provides insight into segregation-of-duties violations and policy conflicts across access assignments.",
    icon: ShieldAlert,
    href: "/oracle-reports/access-guardrail-report",
  },
];

const COMPLIANCE_STANDARDS = [
  "NIST 800-53",
  "PCI-DSS",
  "SOX-ITGC",
  "ISO 27001",
  "CIS v8",
];

function ReportLink({ label }: { label: string }) {
  const normalise = (value: string) =>
    value.replace(/[\u2013\u2014]/g, "-").toLowerCase();

  const card = REPORT_CARDS.find(
    (c) =>
      normalise(c.title) === normalise(label) ||
      normalise(c.title).includes(normalise(label)) ||
      normalise(label).includes(normalise(c.title)),
  );

  if (!card) {
    return <span>{label}</span>;
  }

  return (
    <Link href={card.href} className="text-blue-600 hover:underline">
      {label}
    </Link>
  );
}

function DefaultReportsView() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {REPORT_CARDS.map((card) => (
        <DashboardCard
          key={card.title}
          title={card.title}
          href={card.href}
          icon={card.icon}
          description={card.description}
        />
      ))}
    </div>
  );
}

function ComplianceReportsView() {
  const [selectedStandard, setSelectedStandard] = useState<string>(
    COMPLIANCE_STANDARDS[0],
  );

  const getBorderClasses = (standard: string) => {
    switch (standard) {
      case "NIST 800-53":
        return "border-blue-300";
      case "PCI-DSS":
        return "border-red-300";
      case "SOX-ITGC":
        return "border-amber-300";
      case "ISO 27001":
        return "border-emerald-300";
      case "CIS v8":
        return "border-purple-300";
      default:
        return "border-gray-200";
    }
  };

  const getSelectedCardClasses = (standard: string) => {
    switch (standard) {
      case "NIST 800-53":
        return "bg-blue-100 text-blue-900 border-blue-400";
      case "PCI-DSS":
        return "bg-red-100 text-red-900 border-red-400";
      case "SOX-ITGC":
        return "bg-amber-100 text-amber-900 border-amber-400";
      case "ISO 27001":
        return "bg-emerald-100 text-emerald-900 border-emerald-400";
      case "CIS v8":
        return "bg-purple-100 text-purple-900 border-purple-400";
      default:
        return "bg-gray-100 text-gray-900 border-gray-300";
    }
  };

  return (
    <div className="py-4 space-y-4">
      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-3 min-w-[900px]">
          {COMPLIANCE_STANDARDS.map((standard) => {
            const isSelected = selectedStandard === standard;
            return (
              <button
                key={standard}
                type="button"
                onClick={() => setSelectedStandard(standard)}
                className={`w-full rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? getSelectedCardClasses(standard)
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {standard}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`border rounded-md bg-white shadow-sm ${getBorderClasses(
          selectedStandard,
        )}`}
      >
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-800">
          {selectedStandard}
        </div>
        <div className="px-4 pb-4 pt-3 text-xs text-gray-600">
          {selectedStandard === "NIST 800-53" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Control
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Definition
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AC-2 (Account Management), AC-3 (Access Enforcement), AC-5
                        (Separation of Duties), AU-2 (Audit Events)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Demonstrate formal provisioning process &amp; approval
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Access Request Summary Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AC-2(3), AC-2(12), IA-11
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Inactive account management
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Last Login Report – Application" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AC-2(2), AC-2(4)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Removal/disabling of temporary and emergency accounts with full lifecycle auditing
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Deleted Application Accounts Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AU-2, AU-6, AC-2
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Governs full account lifecycle management including provisioning, reviews, and deprovisioning
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Access History Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AC-2, IA-4
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Centrally manage user/system accounts and identify and disable inactive ones for clean identity governance
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Orphan Account Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2 whitespace-pre-wrap break-words">
                        AC-2, AC-5
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Access authorization controls during provisioning and certifications
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Current Access Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        AC-1 (Policy &amp; Procedures)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Governing organization's access control policy through automated workflows, role-based provisioning, and auditable reporting on policy compliance
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Policies Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-3 py-2 whitespace-pre-wrap break-words">
                        AC-3, AC-5, AC-6
                      </td>
                      <td className="px-3 py-2">
                        Prevent conflicting duties (AC-5), and apply least privilege by managing just-in-time roles, periodic access reviews, and privilege cleanup for identity-based reporting.
                      </td>
                      <td className="px-3 py-2">
                        <ReportLink label="SOD Violation Report" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : selectedStandard === "PCI-DSS" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Control
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Definition
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 7.2, 7.3
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Access granted based on business need-to-know
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Access Request Summary Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 8.2.6
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Disable inactive accounts within 90 days
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Last Login Report – Application" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 8.2.2
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Deleted Application Accounts Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 10 (Logging &amp; Monitoring)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Access History Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 7 &amp; 8
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Orphan Account Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 7
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Current Access Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Req 12
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Policies Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-3 py-2">
                        Req 7 (least privilege)
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <ReportLink label="SOD Violation Report" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : selectedStandard === "SOX-ITGC" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Control
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Definition
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Logical Access Controls
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Evidence of controlled access provisioning
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Access Request Summary Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Periodic access review support
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Identify stale accounts
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Last Login Report – Application" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Termination controls ITGC
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Reports completion status for SOX termination evidence.
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Deleted Application Accounts Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Change Management + Logical Access
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Provides auditable reports linking identity changes to identity lifecycle workflows
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Access History Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Unauthorized access risk
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Exception reporting on over-privileged or orphaned accounts.
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Orphan Account Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Quarterly Access Reviews
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        SOX-compliant reports on reviewed and remediated user entitlements
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Current Access Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control Design documentation
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Documentation of access control workflows, policies, and automated processes to support SOX control design evidence and testing
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Policies Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-3 py-2">Preventive SoD controls</td>
                      <td className="px-3 py-2">
                        Report SoD violations by detecting role conflicts, blocking conflicting access requests, and reporting preventive enforcement actions.
                      </td>
                      <td className="px-3 py-2">
                        <ReportLink label="SOD Violation Report" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : selectedStandard === "ISO 27001" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Control
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Definition
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.15, A.5.18
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Access control &amp; access rights management
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Access Request Summary Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.18
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Removal or adjustment of access rights
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Last Login Report – Application" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.18
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Deleted Application Accounts Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.8.15 Logging
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Access History Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.18
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Orphan Account Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.15
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Current Access Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        A.5.1 Policies for Information Security
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Policies Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-3 py-2">A.5.15</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <ReportLink label="SOD Violation Report" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : selectedStandard === "CIS v8" ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Control
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Definition
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                        Report
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 5 (Account Management)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Managed provisioning lifecycle
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Access Request Summary Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 5.3
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        Disable dormant accounts
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Last Login Report – Application" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 5.4
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Deleted Application Accounts Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 8 (Audit Log Management)
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Access History Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 5.2
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Orphan Account Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 6
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="User Current Access Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="border-b border-gray-200 px-3 py-2">
                        Control 17
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2"></td>
                      <td className="border-b border-gray-200 px-3 py-2">
                        <ReportLink label="Policies Report" />
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-3 py-2">Control 6.8</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <ReportLink label="SOD Violation Report" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <>Compliance details for {selectedStandard} will appear here.</>
            )}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const tabsData = useMemo(
    () => [
      {
        label: "Default View",
        component: DefaultReportsView,
      },
      {
        label: "Compliance View",
        component: ComplianceReportsView,
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-2 px-1">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-black mb-6">
            Reports
          </h1>

          <Tabs
            tabs={tabsData}
            activeClass="bg-blue-600 text-white rounded-lg"
            buttonClass="text-base px-3 py-1"
            className="justify-center"
          />
        </div>
      </div>
    </div>
  );
}

