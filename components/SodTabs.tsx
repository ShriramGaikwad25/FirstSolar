"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SOD_TABS = [
  { label: "Business Process", href: "/settings/gateway/sod" },
  { label: "Rules", href: "/settings/gateway/sod/rules" },
  { label: "SoD Policy", href: "/settings/gateway/sod/policy" },
  { label: "Mitigating Controls", href: "/settings/gateway/sod/mitigating-controls" },
];

export default function SodTabs() {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label="SoD Tabs"
      className="flex flex-shrink-0 gap-2 mb-4"
    >
      {SOD_TABS.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href === "/settings/gateway/sod" && pathname === "/settings/gateway/sod");

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

