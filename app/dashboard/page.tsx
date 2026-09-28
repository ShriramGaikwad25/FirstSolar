"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  AlertTriangle,
  ShieldAlert,
  Inbox,
  Clock,
} from "lucide-react";
import SectionActivityChart from "@/components/SectionActivityChart";
import { getReviewerId } from "@/lib/auth";
import { getCertAnalytics, executeQuery } from "@/lib/api";
import { navLinks } from "@/components/Navi";

interface DashboardStats {
  totalApplications: number;
  totalUsers: number;
  highRiskItems: number;
  sodViolations: number;
  myApprovals: number;
}

const EMPTY_STATS: DashboardStats = {
  totalApplications: 0,
  totalUsers: 0,
  highRiskItems: 0,
  sodViolations: 0,
  myApprovals: 0,
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);

  useEffect(() => {
    const fetchDashboard = async () => {
      const reviewerId = getReviewerId();
      if (!reviewerId) {
        setLoading(false);
        return;
      }

      try {
        const [appsResponse, analyticsData, usersCountResponse, myApprovalsResponse] =
          await Promise.all([
            fetch(
              `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getApplications/${reviewerId}?page=1&page_size=1`
            )
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null),
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

        if (usersCountResponse?.resultSet?.[0]) {
          const count = usersCountResponse.resultSet[0].count;
          setStats((prev) => ({ ...prev, totalUsers: typeof count === "number" ? count : 0 }));
        }

        if (myApprovalsResponse?.resultSet?.[0]) {
          const count = myApprovalsResponse.resultSet[0].count;
          setStats((prev) => ({ ...prev, myApprovals: typeof count === "number" ? count : 0 }));
        }

        if (analyticsData?.analytics) {
          let totalHighRiskEntitlements = 0;
          let totalHighRiskAccounts = 0;
          let totalViolations = 0;

          Object.values(analyticsData.analytics).forEach((a: any) => {
            totalHighRiskEntitlements += Number(a.highriskentitlement_count) || 0;
            totalHighRiskAccounts += Number(a.highriskaccount_count) || 0;
            totalViolations += Number(a.violations_count) || 0;
          });

          const totalHighRisk = totalHighRiskEntitlements + totalHighRiskAccounts;

          setStats((prev) => ({ ...prev, highRiskItems: totalHighRisk, sodViolations: totalViolations }));
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

  const administrationItemCount =
    navLinks.find((section) => section.name === "Administration")?.subItems?.length ?? 0;

  const sectionActivity = [
    { label: "My Workspace — Users", value: stats.totalUsers, color: "#6366F1" },
    { label: "Request Management — Open Approvals", value: stats.myApprovals, color: "#16A34A" },
    { label: "Risk Analysis — SoD Violations", value: stats.sodViolations, color: "#EA580C" },
    { label: "Administration — Items", value: administrationItemCount, color: "#6B7280" },
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
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

      {/* Section activity chart — one bar per sidebar section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Section Activity</h2>
        <p className="text-xs text-gray-400 mb-2">Live counts across the sidebar's sections</p>
        <SectionActivityChart data={sectionActivity} />
      </div>

      {/* Quick links — mirrors the left navigation sidebar's sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {navLinks
          .filter((section) => section.subItems && section.subItems.length > 0)
          .map((section) => {
            const SectionIcon = section.icon;
            return (
              <div
                key={section.name}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <SectionIcon className="h-4 w-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-900">{section.name}</h2>
                </div>
                <div className="flex flex-col gap-1">
                  {section.subItems!.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        <ItemIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
