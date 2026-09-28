import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import type { ChartOptions } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export interface SectionActivityItem {
  label: string;
  value: number;
  color: string;
}

interface SectionActivityChartProps {
  data: SectionActivityItem[];
}

export default function SectionActivityChart({ data }: SectionActivityChartProps) {
  const chartData = {
    labels: data.map((item) => item.label),
    datasets: [
      {
        data: data.map((item) => item.value),
        backgroundColor: data.map((item) => item.color),
        borderRadius: 4,
        barThickness: 28,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { display: false, beginAtZero: true },
      y: {
        grid: { display: false },
        ticks: { font: { size: 13 }, color: "#374151" },
      },
    },
  };

  return (
    <div className="w-full" style={{ height: `${data.length * 48 + 16}px` }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
