import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, ChartOptions } from "chart.js";

// Register required Chart.js elements
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface HorizontalBarChartProps {
  analyticsData?: {
    totalEntitlements?: number;
    newAccess?: number;
    directAssignment?: number;
    groupAssignment?: number;
    lowRisk?: number;
    highRisk?: number;
  };
}

const HorizontalBarChart = ({ analyticsData }: HorizontalBarChartProps) => {
  // Calculate values from analytics data or use defaults
  const totalEntitlements = analyticsData?.totalEntitlements || 0;
  const newAccess = analyticsData?.newAccess || 0;
  const directAssignment = analyticsData?.directAssignment || 0;
  const groupAssignment = analyticsData?.groupAssignment || 0;
  const lowRisk = analyticsData?.lowRisk || 0;
  const highRisk = analyticsData?.highRisk || 0;

  const data = {
    labels: ["Total Entitlements", "New", "Direct Assignment", "Group Assignment", "Low Risk", "Risk"],
    datasets: [
      {
        data: [totalEntitlements, newAccess, directAssignment, groupAssignment, lowRisk, highRisk],
        backgroundColor: ["#2979FF", "#00BFA5", "#9933FF", "#11C65E", "#F9B824", "#00BCD4"],
        borderRadius: 4,
        barThickness: 32, // Adjust bar height
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const, // Horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, // Hide default legend
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        display: false, // Hide x-axis
      },
      y: {
        grid: { display: false },
        ticks: {
          align: "center", // Align labels to the right
          font: { size: 14 },
          color: "#6B7280",
        },
      },    
    },
  };

  return (
    <div className="w-full h-70 p-4">
      <Bar data={data} options={options} />
    </div>
  );
};

export default HorizontalBarChart;