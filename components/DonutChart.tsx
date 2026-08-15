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
    labels: ["Access", "Low Risk", "Roles", "John Kelly", "SOD Violations", "Inactive Accounts"],
    datasets: [
      {
        data: [totalAccess, lowRisk, roles, users, sodViolations, inactiveAccounts],
        backgroundColor: ["#2979FF", "#00BFA5", "#9933FF", "#11C65E", "#F9B824", "#00BCD4"],
        borderWidth: 2,
      },
    ],
  };

  // Calculate total for percentage display
  const total = chartData.datasets[0].data.reduce((sum, val) => sum + val, 0);
  const percentage = total > 0 ? Math.round((totalAccess / total) * 100) : 0;

  const options = {
    responsive: true,
    cutout: "72%", // Controls the thickness of the donut
    plugins: {
      legend: { display: false }, // Hide default legend
      tooltip: { enabled: false }, // Disable tooltips to hide numbers on hover
      datalabels: { display: false }, // Hide data labels on chart if plugin is used
    },
  };

  return (
    <div className="flex gap-6 p-4">
      {/* Donut Chart */}   
      <div className="w-52 relative">
        <Doughnut data={chartData} options={options} />

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-gray-500 text-sm">Total Access</span>
          <span className="text-black font-bold text-2xl">{totalAccess}</span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="mt-4 w-48 space-y-2">
        {chartData.labels.map((label, index) => (
          <div key={index} className="flex items-center gap-2 text-gray-600 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartData.datasets[0].backgroundColor[index] }}></div>
            <span>{label}</span>
            <span className="ml-auto font-bold">{chartData.datasets[0].data[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
