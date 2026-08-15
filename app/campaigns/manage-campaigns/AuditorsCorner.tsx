import React from "react";
import { Flag, MapPin, Download, FileText } from "lucide-react";

const Timeline = () => {
  const milestones = [
    {
      badge: {
        text: "Q3 SOX Campaign Initiation on July 10th 2025",
        className: "bg-indigo-100 text-indigo-700",
      },
      leftContent: (
        <>
          <p>
            Initiated using template{" "}
            <strong>“Quarterly SOX User Manager Certification”</strong>.
          </p>
          <p>
            <strong>John Doe</strong> is cert template owner and{" "}
            <strong>Phil Brown</strong> ran this template.
          </p>
        </>
      ),
      rightContent: (
        <DownloadCard
          title="Reports Linked"
          links={[{ label: "Certification definition template", href: "#" }]}
        />
      ),
    },
    {
      badge: {
        text: "Campaign closed on August 30th",
        className: "bg-blue-100 text-blue-700",
      },
      leftContent: (
        <p>
          <strong>300 revokes</strong>, <strong>8600 approvals</strong>,{" "}
          <strong>500+ delta entitlements</strong>,{" "}
          <strong>60 remediations</strong>, <strong>20 reassigns</strong>,{" "}
          <strong>950 delegations</strong>
        </p>
      ),
      rightContent: (
        <DownloadCard
          title="Certification Report"
          links={[
            {
              label:
                "Download Full Report (filter by reviewer, decision, delta, etc.)",
              href: "#",
            },
          ]}
        />
      ),
    },
        {
      badge: {
        text: "Data Snapshot created on July 10th",
        className: "bg-violet-100 text-violet-700",
      },
      leftContent: (
        <div className="space-y-4">
          <p>
            <strong>10 apps</strong>, <strong>8000 users</strong>,{" "}
            <strong>500 reviewers</strong>, and <strong>68k assignments</strong>{" "}
          </p>
        </div>
      ),
      rightContent: (
        <div className="grid gap-4">
          {[
            {
              app: "Salesforce",
              date: "July 17th",
              type: "SCIM Integration",
              records: { pulled: 8400, reconciled: 8300, failed: 100 },
            },
            {
              app: "HR App / IGA tool",
              date: "July 17th",
              type: "Flat file",
              records: { pulled: 8400, reconciled: 8300, failed: 100 },
            },
          ].map((card, index) => (
            <SnapshotCard
              key={index}
              app={card.app}
              date={card.date}
              type={card.type}
              href="#"
              records={card.records}
            />
          ))}
        </div>
      ),
    },
    {
      badge: {
        text: "Closed loop remediation complete",
        className: "bg-orange-100 text-orange-800",
      },
      leftContent: (
        <div className="space-y-4">
          <p>
            Closed loop remediation completed on <strong>September 15th</strong>{" "}
            with <strong>60 automated revokes</strong> and{" "}
            <strong>240 manual revokes</strong>.
          </p>
        </div>
      ),
      rightContent: (
        <DownloadCard
          title="Detailed Revocation Report"
          links={[
            {
              label:
                "Download per-application revocation report",
              href: "#",
            },
          ]}
        />
      ),
    },

  ];

  return (
    <div className="max-w-6xl p-6 mx-auto">
      {/* Available reports row at top */}
      <div className="mb-10">
        <div className="flex items-center justify-center flex-wrap gap-3">
          <span className="text-sm text-gray-700 font-medium mr-1">
            Available Reports:
          </span>
          {[
            "High Risk Users",
            "Inactive Accounts",
            "SOD Violations",
            "Privileged Accounts",
            "Orphan Accounts",
          ].map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm shadow-sm"
            >
              <FileText className="w-4 h-4 text-gray-700" />
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-1/2 top-0 w-px bg-gray-300 h-full -translate-x-1/2 z-0" />
        <div className="space-y-16 relative z-10">
          {milestones.map((milestone, index) => (
            <Milestone
              key={index}
              badge={milestone.badge}
              leftContent={milestone.leftContent}
              rightContent={milestone.rightContent}
              minHeight={(milestone as any).minHeight}
              iconType={
                index === 0 || index === milestones.length - 1 ? "flag" : "pin"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const Milestone = ({
  badge,
  leftContent,
  rightContent,
  iconType,
  minHeight,
}: {
  badge: { text: string; className?: string };
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  iconType: string;
  minHeight?: number;
}) => {
  const renderIcon = () => {
    if (iconType === "flag") return <Flag className="text-red-500 w-4 h-4" />;
    if (iconType === "pin") return <MapPin className="text-blue-500 w-4 h-4" />;
    return <div className="w-4 h-4 bg-blue-500 rounded-full" />;
  };

  return (
    <div
      className="relative pt-12 grid grid-cols-[1fr_2rem_1fr] items-start gap-8"
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
    >
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 text-center">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full shadow-sm border ${
            badge.className || "bg-blue-100 text-blue-700"
          }`}
        >
          {badge.text}
        </span>
      </div>
      <div className="pr-6 flex justify-end">
        <div className="bg-white border border-gray-200 shadow rounded-xl p-6 w-full max-w-md">
          {leftContent}
        </div>
      </div>
      <div className="relative flex items-center justify-center">
        {/** Flag gets soft red chip; Pin gets subtle blue outlined chip */}
        <div
          className={`z-10 p-1 rounded-full shadow ${
            iconType === "flag"
              ? "bg-[#FFD7D4]"
              : "bg-blue-50 border border-blue-200"
          }`}
        >
          {renderIcon()}
        </div>
      </div>
      <div className="pl-6 flex justify-start">
        <div className="bg-gray-50 border border-gray-200 shadow rounded-xl p-6 w-full max-w-3xl">
          {rightContent}
        </div>
      </div>
    </div>
  );
};

const DownloadCard = ({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) => (
  <div className="bg-white border border-gray-200 shadow-md rounded-xl p-4">
    <h4 className="text-lg font-semibold mb-2">{title}</h4>
    <div className="space-y-2">
      {links.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition text-base"
        >
          <span className="underline">{link.label}</span>
          <Download className="w-5 h-5 text-blue-600" />
        </a>
      ))}
    </div>
  </div>
);

const SnapshotCard = ({
  app,
  date,
  type,
  href,
  records,
}: {
  app: string;
  date: string;
  type: string;
  href: string;
  records: { pulled: number; reconciled: number; failed: number };
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h5 className="font-semibold text-gray-800">{app}</h5>
      <div className="flex items-center gap-3 mt-2 mb-3">
        <span className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700">
          <span role="img" aria-label="calendar">📅</span> {date}
        </span>
        <span className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700">
          <span role="img" aria-label="plug">🔌</span> {type}
        </span>
      </div>
      <div className="text-sm flex flex-wrap gap-x-6 gap-y-1">
        <p>Pulled: <span className="font-semibold">{records.pulled}</span></p>
        <p>Reconciled: <span className="font-semibold">{records.reconciled}</span></p>
        <p className="text-red-600">Failed: <span className="font-semibold">{records.failed}</span></p>
      </div>
      <a href={href} className="inline-block mt-3 text-blue-600 hover:underline text-sm">View Snapshot Report</a>
    </div>
  </div>
);

export default Timeline;
