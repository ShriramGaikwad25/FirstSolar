import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  ChartOptions,
} from "chart.js";

// Register required Chart.js elements
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface ProgressData {
  totalItems: number;
  approvedCount: number;
  pendingCount: number;
  revokedCount: number;
  delegatedCount: number;
  remediatedCount: number;
}

interface ProgressHorizontalBarChartProps {
  data?: ProgressData;
  height?: string;
}

const ProgressHorizontalBarChart: React.FC<ProgressHorizontalBarChartProps> = ({ 
  data,
  height = "h-48"
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

  const chartData = {
    labels: ["Pending", "Approved", "Revoked", "Delegated", "Remediated"],
    datasets: [
      {
        data: [
          progressData.pendingCount,
          progressData.approvedCount,
          progressData.revokedCount,
          progressData.delegatedCount,
          progressData.remediatedCount,
        ],
        backgroundColor: [
          "#6EC6FF", // Pending
          "#50BFA5", // Approved
          "#6478B9", // Revoked
          "#E67E5A", // Delegated
          "#4F46E5", // Remediated
        ],
        borderRadius: 4,
        barThickness: 24,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const, // Horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed.x || 0;
            const percentage = progressData.totalItems > 0 
              ? ((value / progressData.totalItems) * 100).toFixed(1)
              : "0.0";
            return `${label}: ${value} items (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        display: false, // Hide x-axis
      },
      y: {
        grid: { display: false },
        ticks: {
          align: "center",
          font: { size: 12 },
          color: "#6B7280",
        },
      },
    },
  };

  return (
    <div className={`${height} w-full p-2`}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ProgressHorizontalBarChart;
