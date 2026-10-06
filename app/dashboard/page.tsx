"use client";

import { getBackendOrigin } from "@/lib/backendOrigin";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  AlertTriangle,
  Search,
  Inbox,
  Clock,
} from "lucide-react";
import { getReviewerId, apiRequestWithAuth, getJwtAuthHeaders, resolveTenantIdForHeader } from "@/lib/auth";
import { getCertAnalytics, executeQuery } from "@/lib/api";
import { navLinks } from "@/components/Navi";
import { filterNavForRole, useRoleAccess } from "@/lib/roleAccess";

interface DashboardStats {
  totalApplications: number;
  totalUsers: number;
  highRiskItems: number;
  trackRequests: number;
  myApprovals: number;
}

const EMPTY_STATS: DashboardStats = {
  totalApplications: 0,
  totalUsers: 0,
  highRiskItems: 0,
  trackRequests: 0,
  myApprovals: 0,
};

// Accent colors for the quick-link sections, drawn from the app's existing palette
const sectionPalette = [
  { bg: "#E5EEFC", fg: "#1759E4" },
  { bg: "#EEF0F8", fg: "#6574BD" },
  { bg: "#E8F3E8", fg: "#1C821C" },
  { bg: "#FCEFEB", fg: "#E0745A" },
];

// Per-link icon colors, so links inside a section card don't all share one hue
const itemIconColors = ["#1759E4", "#6574BD", "#1C821C", "#E0745A", "#F59E0B", "#DC2626"];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const roleAccess = useRoleAccess();

  useEffect(() => {
    const fetchDashboard = async () => {
      const reviewerId = getReviewerId();
      if (!reviewerId) {
        setLoading(false);
        return;
      }

      try {
        const [appsResponse, analyticsData, usersCountResponse, myApprovalsResponse, trackRequestsResponse] =
          await Promise.all([
            // Same request as the Applications page so the count matches it
            fetch(
              `${getBackendOrigin()}/entities/api/v1/${encodeURIComponent(resolveTenantIdForHeader())}/getApplications/${reviewerId}?page=1&page_size=1000`,
              { headers: getJwtAuthHeaders() }
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
            apiRequestWithAuth<any>(
              `${getBackendOrigin()}/workflow/api/v1/${encodeURIComponent(resolveTenantIdForHeader())}/request/raisedby/${encodeURIComponent(
                String(reviewerId).trim()
              )}?page=0&size=1`,
              { method: "GET" }
            ).catch(() => null),
          ]);

        if (appsResponse && appsResponse.executionStatus === "success") {
          const items = Array.isArray(appsResponse.items) ? appsResponse.items : [];
          setStats((prev) => ({ ...prev, totalApplications: appsResponse.total_items || items.length }));
        }

        if (usersCountResponse?.resultSet?.[0]) {
          const count = usersCountResponse.resultSet[0].count;
          setStats((prev) => ({ ...prev, totalUsers: typeof count === "number" ? count : 0 }));
        }

        if (myApprovalsResponse?.resultSet?.[0]) {
          const count = myApprovalsResponse.resultSet[0].count;
          setStats((prev) => ({ ...prev, myApprovals: typeof count === "number" ? count : 0 }));
        }

        if (trackRequestsResponse?.dbResponse) {
          const total = Number(trackRequestsResponse.dbResponse.page?.totalElements);
          const fallback = Array.isArray(trackRequestsResponse.dbResponse.data)
            ? trackRequestsResponse.dbResponse.data.length
            : 0;
          setStats((prev) => ({ ...prev, trackRequests: Number.isFinite(total) ? total : fallback }));
        }

        if (analyticsData?.analytics) {
          let totalHighRiskEntitlements = 0;
          let totalHighRiskAccounts = 0;

          Object.values(analyticsData.analytics).forEach((a: any) => {
            totalHighRiskEntitlements += Number(a.highriskentitlement_count) || 0;
            totalHighRiskAccounts += Number(a.highriskaccount_count) || 0;
          });

          const totalHighRisk = totalHighRiskEntitlements + totalHighRiskAccounts;

          setStats((prev) => ({ ...prev, highRiskItems: totalHighRisk }));
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
      color: "#1759E4",
      tint: "#E5EEFC",
      href: "/applications",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "#6574BD",
      tint: "#EEF0F8",
      href: "/user",
    },
    {
      title: "High-Risk Items",
      value: stats.highRiskItems,
      icon: AlertTriangle,
      color: "#DC2626",
      tint: "#FEF2F2",
      href: "/risk-analysis",
    },
    {
      title: "Track Requests",
      value: stats.trackRequests,
      icon: Search,
      color: "#F59E0B",
      tint: "#FEF6E7",
      href: "/track-request",
    },
    {
      title: "My Approvals",
      value: stats.myApprovals,
      icon: Inbox,
      color: "#1C821C",
      tint: "#E8F3E8",
      href: "/access-request/pending-approvals",
    },
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
              className="relative overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:shadow-md hover:border-gray-300 transition"
            >
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: tile.color }} />
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: tile.tint, color: tile.color }}
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

      {/* Quick links — mirrors the left navigation sidebar's sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(roleAccess ? filterNavForRole(navLinks, roleAccess) : [])
          .filter((section) => section.subItems && section.subItems.length > 0)
          .map((section, index) => {
            const SectionIcon = section.icon;
            const palette = sectionPalette[index % sectionPalette.length];
            return (
              <div
                key={section.name}
                className="relative overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm p-4"
              >
                <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: palette.fg }} />
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: palette.bg, color: palette.fg }}
                  >
                    <SectionIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">{section.name}</h2>
                </div>
                <div className="flex flex-col gap-1">
                  {section.subItems!.map((item, itemIndex) => {
                    const ItemIcon = item.icon;
                    const itemColor = itemIconColors[(index + itemIndex) % itemIconColors.length];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-[var(--hover-bg)] transition-colors"
                        style={{ "--hover-bg": palette.bg } as React.CSSProperties}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" style={{ color: itemColor }} />
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
