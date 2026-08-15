"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ADVANCED_INTEGRATION_OPERATION_TABS,
  partitionFieldsByAdvancedOperationTabs,
} from "@/lib/api";

export type AdvancedIntegrationOperationTabsProps = {
  fieldKeys: string[];
  renderFields: (keys: string[]) => React.ReactNode;
  className?: string;
};

/** Eight operation tabs inside the Advanced integration group: Create, Update, Delete, etc. */
export default function AdvancedIntegrationOperationTabs({
  fieldKeys,
  renderFields,
  className = "",
}: AdvancedIntegrationOperationTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const partitioned = useMemo(
    () => partitionFieldsByAdvancedOperationTabs(fieldKeys),
    [fieldKeys]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [fieldKeys]);

  const activeEntry = partitioned[activeIndex] ?? partitioned[0];

  return (
    <div className={className}>
      <div className="grid grid-cols-8 w-full gap-1 mb-3 border-b border-gray-200 pb-2.5">
        {ADVANCED_INTEGRATION_OPERATION_TABS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`min-w-0 rounded-md px-1.5 py-1.5 text-xs leading-snug font-medium transition-colors text-center ${
              activeIndex === index
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeEntry ? (
        activeEntry.fieldKeys.length > 0 ? (
          renderFields(activeEntry.fieldKeys)
        ) : (
          <p className="text-sm text-gray-500 py-4">No fields configured for this section.</p>
        )
      ) : null}
    </div>
  );
}
