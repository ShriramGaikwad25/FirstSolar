import React, { useState } from "react";
import DonutChart from "./DonutChart";
import HorizontalBarChart from "./HorizontalBarChart";
import ProgressDonutChart from "./ProgressDonutChart";
import ProgressHorizontalBarChart from "./ProgressHorizontalBarChart";
import VennChart from "./VennChart";
import FilterPanel from "./FilterPannel";

interface DataItem {
  label: string;
  value: number;
  color?: string;
}

interface ChartComponentProps {
  progressData?: {
    totalItems: number;
    approvedCount: number;
    pendingCount: number;
    revokedCount: number;
    delegatedCount: number;
    remediatedCount: number;
  };
}

const ChartComponent: React.FC<ChartComponentProps> = ({ progressData }) => {
  //   InteractiveFilters: [
  //     { label: "Over Privileged Users", value: 0 },
  //     { label: "Dormant Access", value: 0 },
  //     { label: "Compliance Violations", value: 0 },
  //     { label: "High Risk Entities", value: 0 },
  //     { label: "New/Delta Access", value: 0 },
  //     {label: "Access Anamoly", value:0}
  //   ],
  // };

    const allData: DataItem[] = [
        { label: "Over Privileged Users", value: 0 },
      { label: "Dormant Access", value: 0 },
      { label: "Compliance Violations", value: 0 },
      { label: "High Risk Entities", value: 0 },
      { label: "New/Delta Access", value: 0 },
      {label: "Access Anamoly", value:0}
  ];
    const data: Record<string, DataItem[]> = {
    "InteractiveFilters": allData.slice(0, 3), // First 4 records
    " ": allData.slice(3),   // Remaining 3 records
  };
  
  const [selected, setSelected] = useState<{ [key: string]: number | null }>(
    {}
  );
  const handleSelect = (category: string, index: number) => {
    setSelected((prev) => ({
      ...prev,
      [category]: prev[category] === index ? null : index,
    }));
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="w-90 mt-2">
        <FilterPanel
          data={{ "InteractiveFilters": data["InteractiveFilters"] }}
          selected={selected}
          onSelect={handleSelect}
          onClear={(category) =>
            setSelected((prev) => ({ ...prev, [category]: null }))
          }
        />
      </div>
      <div className="mt-2 w-90">
        <FilterPanel
          data={{ " ": data[" "] }}
          selected={selected}
          onSelect={handleSelect}
          onClear={(category) =>
            setSelected((prev) => ({ ...prev, [category]: null }))
          }
        />
      </div>

      <div className="">
        <div className="flex justify-between p-1">
          <h2 className="text-sm text-gray-700">Progress Summary</h2>
        </div>
        <ProgressHorizontalBarChart data={progressData} />
      </div>
    </div>
  );
};



export default ChartComponent;
