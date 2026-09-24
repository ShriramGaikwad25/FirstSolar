"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  Inbox,
  ArrowRight,
  Clock,
} from "lucide-react";
import DonutChart from "@/components/DonutChart";
import HorizontalBarChart from "@/components/HorizontalBarChart";
import PolarAreaRiskChart from "@/components/PolarAreaRiskChart";
import { getReviewerId } from "@/lib/auth";
import { getCertifications, getCertAnalytics, executeQuery } from "@/lib/api";

interface DashboardStats {
  totalApplications: number;
  activeReviews: number;
  totalUsers: number;
  highRiskItems: number;
  sodViolations: number;
  myApprovals: number;
}

interface ChartAnalyticsData {
  totalAccess: number;
  lowRisk: number;
  roles: number;
  users: number;
  sodViolations: number;
  inactiveAccounts: number;
  totalEntitlements: number;
  newAccess: number;
  directAssignment: number;
  groupAssignment: number;
  highRisk: number;
  dormantAccounts: number;
  orphanAccounts: number;
}

interface CertificationRow {
  id: string;
  name: string;
  percentage: number;
  dueDate: string;
  statusLabel: "On Track" | "At Risk" | "Overdue";
}

const EMPTY_STATS: DashboardStats = {
  totalApplications: 0,
  activeReviews: 0,
  totalUsers: 0,
  highRiskItems: 0,
  sodViolations: 0,
  myApprovals: 0,
};

const EMPTY_CHART_DATA: ChartAnalyticsData = {
  totalAccess: 0,
  lowRisk: 0,
  roles: 0,
  users: 0,
  sodViolations: 0,
  inactiveAccounts: 0,
  totalEntitlements: 0,
  newAccess: 0,
  directAssignment: 0,
  groupAssignment: 0,
  highRisk: 0,
  dormantAccounts: 0,
  orphanAccounts: 0,
};

function formatDueDate(value: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusForRow(percentage: number, dueDate: string): CertificationRow["statusLabel"] {
  const due = dueDate ? new Date(dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return "Overdue";
  if (percentage < 40) return "At Risk";
  return "On Track";
}

const STATUS_STYLES: Record<CertificationRow["statusLabel"], { bg: string; text: string }> = {
  "On Track": { bg: "#F0FDF4", text: "#16A34A" },
  "At Risk": { bg: "#FFFBEB", text: "#B45309" },
  Overdue: { bg: "#FEF2F2", text: "#DC2626" },
};

const PROGRESS_COLOR = (pct: number) => (pct < 20 ? "#DC2626" : pct < 50 ? "#F59E0B" : "#16A34A");

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [chartData, setChartData] = useState<ChartAnalyticsData>(EMPTY_CHART_DATA);
  const [certRows, setCertRows] = useState<CertificationRow[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      const reviewerId = getReviewerId();
      if (!reviewerId) {
        setLoading(false);
        return;
      }

      try {
        const [appsResponse, certificationsData, analyticsData, usersCountResponse, myApprovalsResponse] =
          await Promise.all([
            fetch(
              `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getApplications/${reviewerId}?page=1&page_size=1`
            )
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null),
            getCertifications(reviewerId, 50, 1).catch(() => null),
            getCertAnalytics(reviewerId).catch(() => null),
            executeQuery<{ resultSet?: Array<{ count?: number }> }>("SELECT COUNT(*) as count FROM usr", []).catch(
              () => null
            ),
            executeQuery<{ resultSet?: Array<{ count?: number }> }>(
              "SELECT COUNT(*) as count FROM kf_wf_get_approval_task WHERE assignee_id = ?::uuid AND task_status = 'OPEN'",
              [reviewerId]
            ).catch(() => null),
          ]);

        if (appsResponse && appsResponse.executionStatus === "success") {
          setStats((prev) => ({ ...prev, totalApplications: appsResponse.total_items || 0 }));
        }

        let totalUsersCount = 0;
        if (usersCountResponse?.resultSet?.[0]) {
          const count = usersCountResponse.resultSet[0].count;
          totalUsersCount = typeof count === "number" ? count : 0;
          setStats((prev) => ({ ...prev, totalUsers: totalUsersCount }));
        }

        if (myApprovalsResponse?.resultSet?.[0]) {
          const count = myApprovalsResponse.resultSet[0].count;
          setStats((prev) => ({ ...prev, myApprovals: typeof count === "number" ? count : 0 }));
        }

        if (certificationsData?.certifications?.items) {
          const items = certificationsData.certifications.items;

          const activeReviewsCount = items.filter((item: any) => {
            const certInfo = Array.isArray(item.reviewerCertificationInfo)
              ? item.reviewerCertificationInfo[0]
              : item.reviewerCertificationInfo;
            const status = certInfo?.status?.toLowerCase() || "";
            return ["active", "open", "in progress", "pending"].includes(status);
          }).length;
          setStats((prev) => ({ ...prev, activeReviews: activeReviewsCount }));

          const rows: CertificationRow[] = items
            .map((item: any): CertificationRow | null => {
              const certInfo = Array.isArray(item.reviewerCertificationInfo)
                ? item.reviewerCertificationInfo[0]
                : item.reviewerCertificationInfo;
              const actionInfo = Array.isArray(item.reviewerCertificateActionInfo)
                ? item.reviewerCertificateActionInfo[0]
                : item.reviewerCertificateActionInfo;
              if (certInfo?.certificationSignedOff) return null;

              const percentage = Math.round(actionInfo?.percentageCompleted ?? 0);
              const dueDate = certInfo?.certificationExpiration ?? "";
              return {
                id: `${item.reviewerId}-${item.certificationId}`,
                name: certInfo?.certificationName || "Untitled Certification",
                percentage,
                dueDate,
                statusLabel: statusForRow(percentage, dueDate),
              };
            })
            .filter((row): row is CertificationRow => row !== null)
            .sort((a, b) => a.percentage - b.percentage)
            .slice(0, 4);

          setCertRows(rows);
        }

        if (analyticsData?.analytics) {
          let totalHighRiskEntitlements = 0;
          let totalHighRiskAccounts = 0;
          let totalViolations = 0;
          let totalDormant = 0;
          let totalInactiveAccounts = 0;
          let totalNewAccess = 0;
          let totalOrphan = 0;

          Object.values(analyticsData.analytics).forEach((a: any) => {
            totalHighRiskEntitlements += Number(a.highriskentitlement_count) || 0;
            totalHighRiskAccounts += Number(a.highriskaccount_count) || 0;
            totalViolations += Number(a.violations_count) || 0;
            totalDormant += Number(a.dormant_count) || 0;
            totalInactiveAccounts += Number(a.inactiveaccount_count) || 0;
            totalNewAccess += Number(a.newaccess_count) || 0;
            totalOrphan += Number(a.orphan_count) || 0;
          });

          const totalHighRisk = totalHighRiskEntitlements + totalHighRiskAccounts;
          const totalAccess = totalNewAccess + totalHighRiskEntitlements;
          const lowRisk = Math.max(0, totalAccess - totalHighRisk);
          const totalEntitlements = totalHighRiskEntitlements + lowRisk;

          setStats((prev) => ({ ...prev, highRiskItems: totalHighRisk, sodViolations: totalViolations }));
          setChartData({
            totalAccess,
            lowRisk,
            roles: 0,
            users: totalUsersCount,
            sodViolations: totalViolations,
            inactiveAccounts: totalInactiveAccounts,
            totalEntitlements,
            newAccess: totalNewAccess,
            directAssignment: Math.round(totalEntitlements * 0.6),
            groupAssignment: Math.round(totalEntitlements * 0.4),
            highRisk: totalHighRiskEntitlements,
            dormantAccounts: totalDormant,
            orphanAccounts: totalOrphan,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setUpdatedAt(new Date());
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const kpiTiles = [
    {
      title: "Applications",
      value: stats.totalApplications,
      icon: Building2,
      iconBg: "#EFF6FF",
      iconColor: "#1759E4",
      href: "/applications",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      iconBg: "#EEF2FF",
      iconColor: "#6366F1",
      href: "/user",
    },
    {
      title: "Active Reviews",
      value: stats.activeReviews,
      icon: ClipboardList,
      iconBg: "#F5F3FF",
      iconColor: "#9333EA",
      href: "/access-review",
    },
    {
      title: "High-Risk Items",
      value: stats.highRiskItems,
      icon: AlertTriangle,
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
      href: "/risk-analysis",
    },
    {
      title: "SoD Violations",
      value: stats.sodViolations,
      icon: ShieldAlert,
      iconBg: "#FFF7ED",
      iconColor: "#EA580C",
      href: "/risk-analysis/violations",
    },
    {
      title: "My Approvals",
      value: stats.myApprovals,
      icon: Inbox,
      iconBg: "#F0FDF4",
      iconColor: "#16A34A",
      href: "/access-request/pending-approvals",
    },
  ];

  const riskConcentration = [
    { label: "High-Risk Items", value: stats.highRiskItems, color: "#DC2626" },
    { label: "SoD Violations", value: stats.sodViolations, color: "#EA580C" },
    { label: "Dormant Accounts", value: chartData.dormantAccounts, color: "#F59E0B" },
    { label: "Orphan Accounts", value: chartData.orphanAccounts, color: "#FBBF24" },
    { label: "Inactive Accounts", value: chartData.inactiveAccounts, color: "#9CA3AF" },
  ];

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Security &amp; Access Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1.5">
            Identity posture across {loading ? "…" : stats.totalApplications} applications and{" "}
            {loading ? "…" : stats.totalUsers.toLocaleString()} users
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpiTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.title}
              href={tile.href}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:shadow-md hover:border-gray-300 transition"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: tile.iconBg, color: tile.iconColor }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-gray-900 leading-none">
                {loading ? "…" : tile.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1.5">{tile.title}</div>
            </Link>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Access Distribution</h2>
          <p className="text-xs text-gray-400 mb-2">By category</p>
          <DonutChart
            analyticsData={{
              totalAccess: chartData.totalAccess,
              lowRisk: chartData.lowRisk,
              roles: chartData.roles,
              users: chartData.users,
              sodViolations: chartData.sodViolations,
              inactiveAccounts: chartData.inactiveAccounts,
            }}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Entitlements Overview</h2>
          <p className="text-xs text-gray-400 mb-2">Assignment breakdown</p>
          <HorizontalBarChart
            analyticsData={{
              totalEntitlements: chartData.totalEntitlements,
              newAccess: chartData.newAccess,
              directAssignment: chartData.directAssignment,
              groupAssignment: chartData.groupAssignment,
              lowRisk: chartData.lowRisk,
              highRisk: chartData.highRisk,
            }}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Risk Concentration</h2>
          <p className="text-xs text-gray-400 mb-3">Flagged items by category</p>
          <div className="flex items-center justify-center">
            <PolarAreaRiskChart data={riskConcentration} width={200} height={200} />
          </div>
          <div className="flex flex-col gap-1.5 mt-3">
            {riskConcentration.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                {c.label}
                <span className="ml-auto font-semibold text-gray-900">{loading ? "…" : c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Certifications table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Certifications Needing Attention</h2>
          <Link href="/access-review" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {certRows.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {loading ? "Loading certifications…" : "No open certifications right now."}
          </p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[2.4fr_1.4fr_1fr_1fr] items-center pb-2.5 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <div>Campaign</div>
              <div>Progress</div>
              <div>Due Date</div>
              <div>Status</div>
            </div>
            {certRows.map((row, i) => {
              const style = STATUS_STYLES[row.statusLabel];
              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[2.4fr_1.4fr_1fr_1fr] items-center py-3.5 ${
                    i < certRows.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="text-sm text-gray-900 font-medium">{row.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.percentage}%`, backgroundColor: PROGRESS_COLOR(row.percentage) }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{row.percentage}%</span>
                  </div>
                  <div className="text-xs text-gray-600">{formatDueDate(row.dueDate)}</div>
                  <div>
                    <span
                      className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {row.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
