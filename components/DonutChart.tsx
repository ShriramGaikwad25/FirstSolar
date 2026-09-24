import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register required Chart.js elements
ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartProps {
  analyticsData?: {
    totalAccess?: number;
    lowRisk?: number;
    roles?: number;
    users?: number;
    sodViolations?: number;
    inactiveAccounts?: number;
  };
}

const DonutChart = ({ analyticsData }: DonutChartProps) => {
  // Calculate values from analytics data or use defaults
  const totalAccess = analyticsData?.totalAccess || 0;
  const lowRisk = analyticsData?.lowRisk || 0;
  const roles = analyticsData?.roles || 0;
  const users = analyticsData?.users || 0;
  const sodViolations = analyticsData?.sodViolations || 0;
  const inactiveAccounts = analyticsData?.inactiveAccounts || 0;

  const chartData = {
    labels: ["Low Risk", "Roles", "Users", "SOD Violations", "Inactive Accounts"],
    datasets: [
      {
        data: [lowRisk, roles, users, sodViolations, inactiveAccounts],
        backgroundColor: ["#00BFA5", "#9933FF", "#11C65E", "#F9B824", "#00BCD4"],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%", // Controls the thickness of the donut
    plugins: {
      legend: { display: false }, // Hide default legend
      tooltip: { enabled: false }, // Disable tooltips to hide numbers on hover
      datalabels: { display: false }, // Hide data labels on chart if plugin is used
    },
  };

  return (
    <div className="flex flex-wrap items-center gap-6 p-2">
      {/* Donut Chart */}
      <div className="w-40 h-40 relative shrink-0">
        <Doughnut data={chartData} options={options} />

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-gray-500 text-xs">Total Access</span>
          <span className="text-black font-bold text-xl">{totalAccess.toLocaleString()}</span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="flex-1 min-w-[160px] space-y-2">
        {chartData.labels.map((label, index) => (
          <div key={index} className="flex items-center gap-2 text-gray-600 text-sm">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: chartData.datasets[0].backgroundColor[index] }}
            ></div>
            <span className="truncate">{label}</span>
            <span className="ml-auto font-bold text-gray-900 shrink-0">
              {chartData.datasets[0].data[index].toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
