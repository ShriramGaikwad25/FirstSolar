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

interface VerticalBarChartProps {
  data?: {
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor?: string[];
      borderRadius?: number;
      barThickness?: number;
    }>;
  };
}

const VerticalBarChart: React.FC<VerticalBarChartProps> = ({ data: propData }) => {
  const defaultData = {
    labels: ["0-10%", "10-30%", "30-60%", "60-80%", "80+ %"],
    datasets: [
      {
        data: [10, 30, 20, 50, 40],
        backgroundColor: [
          "#1F485B",
          "#50BFA5",
          "#6EC6FF",
          "#E6A23C",
          "#22C55E",
        ],
        borderRadius: 4,
        barThickness: 40, // Adjust width of bars
      },
    ],
  };

  const data = propData || defaultData;

  // Ensure the dataset has proper styling
  const chartData = {
    ...data,
    datasets: data.datasets.map(dataset => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || [
        "#1F485B",
        "#50BFA5", 
        "#6EC6FF",
        "#E6A23C",
        "#22C55E",
      ],
      borderRadius: dataset.borderRadius || 4,
      barThickness: dataset.barThickness || 40,
    }))
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { 
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${value} instances`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 12 },
          color: "#6B7280",
        },
      },
      y: {
        title: {
          display: true,
          text: "Number of Instances",
          font: { size: 14 },
          color: "#6B7280",
        },
        beginAtZero: true,
        grid: { display: false },
        ticks: {
          font: { size: 14 },
          color: "#6B7280",
        },
      },
    },
  };

  return (
    <div className="w-full h-72 p-4">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default VerticalBarChart;
