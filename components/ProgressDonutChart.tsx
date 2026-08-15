import React from "react";
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

interface ProgressDonutChartProps {
  data?: ProgressData;
  title?: string; // if omitted, no internal header is rendered
  height?: string;
  showBreakdown?: boolean; // show counts under the chart
}

const ProgressDonutChart: React.FC<ProgressDonutChartProps> = ({ 
  data, 
  title,
  height = "h-72",
  showBreakdown = false 
}) => {
  // Use provided data or fall back to default data
  const progressData = data || {
    totalItems: 110,
    approvedCount: 1,
    pendingCount: 4,
    revokedCount: 0,
    delegatedCount: 0,
    remediatedCount: 0,
  };

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
          "#6478B9", // Revoked - Grey
          "#E67E5A", // Delegated - Orange
          "#4F46E5", // Remediated - Purple
        ],
        hoverBackgroundColor: [
          "#5CA9E6",
          "#46A992",
          "#5B6FA3",
          "#D76A50",
          "#4038D1",
        ],
        borderWidth: 0,
      },
    ],
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%", // Creates the donut effect
    layout: {
      padding: { left: 15, right: 24, top: 15, bottom: 15 }, // Keep chart large; legend is compact
    },
    plugins: {
      legend: {
        display: true,
        position: "right" as const,
        align: "center" as const,
        labels: {
          usePointStyle: true,
          pointStyle: "rect",
          padding: 6,
          boxWidth: 8,
          boxHeight: 8,
          font: {
            size: 9,
            weight: "normal" as const,
          },
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                const color = data.datasets[0].backgroundColor[i];
                return {
                  text: label,
                  fillStyle: color,
                  strokeStyle: color,
                  lineWidth: 0,
                  pointStyle: "rect",
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      datalabels: {
        color: "#ffffff",
        font: { 
          weight: "bold" as const,
          size: 10,
        },
        formatter: (value: number) => (value > 0 ? `${Math.round(value)}%` : ""), // Show percentage only if value > 0
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
      {title ? (
        <div className="flex justify-between p-2 mb-2">
          <h2 className="text-lg text-gray-700">{title}</h2>
          <div className="text-sm text-gray-500">Total: {progressData.totalItems}</div>
        </div>
      ) : null}
      <Doughnut data={chartData} options={options} />
      {showBreakdown ? (
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
      ) : null}
    </div>
  );
};

export default ProgressDonutChart;