import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface ProgressData {
  totalItems: number;
  approvedCount: number;
  pendingCount: number;
  revokedCount: number;
  delegatedCount: number;
  remediatedCount: number;
}

interface DynamicProgressSummaryProps {
  rowData: any[];
  title?: string;
  height?: string;
}

const DynamicProgressSummary: React.FC<DynamicProgressSummaryProps> = ({
  rowData,
  title = "Progress Summary",
  height = "h-72",
}) => {
  // Calculate progress data from row data
  const progressData = useMemo((): ProgressData => {
    if (!rowData || rowData.length === 0) {
      return {
        totalItems: 0,
        approvedCount: 0,
        pendingCount: 0,
        revokedCount: 0,
        delegatedCount: 0,
        remediatedCount: 0,
      };
    }

    let totalItems = rowData.length;
    let approvedCount = 0;
    let pendingCount = 0;
    let revokedCount = 0;
    let delegatedCount = 0;
    let remediatedCount = 0;

    // Analyze each row to determine status
    rowData.forEach((row) => {
      // Check various status indicators
      const status = row.status?.toLowerCase() || "";
      const aiInsights = row.aiInsights?.toLowerCase() || "";
      const recommendation = row.recommendation?.toLowerCase() || "";
      const action = row.action?.toLowerCase() || "";

      // Determine the status based on available data
      if (status === "completed" || status === "approved" || 
          aiInsights === "thumbs-up" || recommendation === "certify" ||
          action === "approve") {
        approvedCount++;
      } else if (status === "revoked" || action === "reject" ||
                 recommendation === "revoke") {
        revokedCount++;
      } else if (status === "delegated" || action === "delegate") {
        delegatedCount++;
      } else if (status === "remediated" || action === "remediate") {
        remediatedCount++;
      } else {
        // Default to pending for items that don't have a clear status
        pendingCount++;
      }
    });

    return {
      totalItems,
      approvedCount,
      pendingCount,
      revokedCount,
      delegatedCount,
      remediatedCount,
    };
  }, [rowData]);

  // Calculate percentages with validation to ensure they don't exceed 100%
  const totalProcessedItems = progressData.approvedCount + progressData.revokedCount + 
                             progressData.delegatedCount + progressData.remediatedCount;
  
  // If total processed items exceed total items, normalize the counts proportionally
  let normalizedApproved = progressData.approvedCount;
  let normalizedRevoked = progressData.revokedCount;
  let normalizedDelegated = progressData.delegatedCount;
  let normalizedRemediated = progressData.remediatedCount;
  
  if (totalProcessedItems > progressData.totalItems && progressData.totalItems > 0) {
    const scaleFactor = progressData.totalItems / totalProcessedItems;
    normalizedApproved = Math.round(progressData.approvedCount * scaleFactor);
    normalizedRevoked = Math.round(progressData.revokedCount * scaleFactor);
    normalizedDelegated = Math.round(progressData.delegatedCount * scaleFactor);
    normalizedRemediated = Math.round(progressData.remediatedCount * scaleFactor);
  }
  
  const pendingPercentage = progressData.totalItems > 0 
    ? (progressData.pendingCount / progressData.totalItems) * 100 
    : 0;
  const approvedPercentage = progressData.totalItems > 0 
    ? (normalizedApproved / progressData.totalItems) * 100 
    : 0;
  const revokedPercentage = progressData.totalItems > 0 
    ? (normalizedRevoked / progressData.totalItems) * 100 
    : 0;
  const delegatedPercentage = progressData.totalItems > 0 
    ? (normalizedDelegated / progressData.totalItems) * 100 
    : 0;
  const remediatedPercentage = progressData.totalItems > 0 
    ? (normalizedRemediated / progressData.totalItems) * 100 
    : 0;

  // Data for the donut chart
  const chartData = {
    labels: ["Pending", "Approved", "Revoked", "Delegated", "Remediated"],
    datasets: [
      {
        data: [
          pendingPercentage,
          approvedPercentage,
          revokedPercentage,
          delegatedPercentage,
          remediatedPercentage,
        ],
        backgroundColor: [
          "#6EC6FF", // Pending - Blue
          "#50BFA5", // Approved - Green
          "#6478B9", // Revoked - Purple
          "#E67E5A", // Delegated - Orange
          "#4F46E5", // Remediated - Indigo
        ],
        hoverBackgroundColor: [
          "#5CA9E6",
          "#46A992",
          "#5B6FA3",
          "#D76A50",
          "#4038D1",
        ],
        borderWidth: 2,
      },
    ],
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "45%", // Creates the donut effect
    layout: {
      padding: 30, // Adds space around the chart
    },
    plugins: {
      legend: {
        display: true,
        position: "right" as const,
        align: "center" as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      datalabels: {
        color: "#fafafa",
        font: { weight: "bold" as const },
        formatter: (value: number) => (value > 0 ? `${Math.round(value)}%` : ""),
        offset: 0,
        clip: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            let count = 0;
            
            // Use the appropriate count based on the label
            switch (label) {
              case "Pending":
                count = progressData.pendingCount;
                break;
              case "Approved":
                count = normalizedApproved;
                break;
              case "Revoked":
                count = normalizedRevoked;
                break;
              case "Delegated":
                count = normalizedDelegated;
                break;
              case "Remediated":
                count = normalizedRemediated;
                break;
              default:
                count = Math.round((value / 100) * progressData.totalItems);
            }
            
            return `${label}: ${count} items (${Math.round(value)}%)`;
          },
        },
      },
    },
  };

  return (
    <div className={`${height} w-full`}>
      <div className="flex justify-between p-2 mb-2">
        <h2 className="text-lg text-gray-700">{title}</h2>
        <div className="text-sm text-gray-500">
          Total: {progressData.totalItems}
        </div>
      </div>
      <Doughnut data={chartData} options={options} />
      
      {/* Summary statistics below the chart */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Pending:</span>
          <span className="font-medium">{progressData.pendingCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Approved:</span>
          <span className="font-medium text-green-600">{normalizedApproved}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Revoked:</span>
          <span className="font-medium text-purple-600">{normalizedRevoked}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Delegated:</span>
          <span className="font-medium text-orange-600">{normalizedDelegated}</span>
        </div>
      </div>
    </div>
  );
};

export default DynamicProgressSummary;
