import React from "react";
import { Doughnut } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface MultiSeriesPieItem {
  label: string;
  value: number;
  color: string;
}

interface MultiSeriesPieProps {
  series: MultiSeriesPieItem[];
  width?: number;
  height?: number;
  /** When false (default), numeric labels are not drawn on chart slices. */
  showDataLabels?: boolean;
}

const FALLBACK_REMAINDER_COLOR = "#E5E7EB";

function getLightRemainderColor(color: string) {
  // Convert #RRGGBB to rgba with low alpha for remainder slices.
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }
  return FALLBACK_REMAINDER_COLOR;
}

export default function MultiSeriesPie({
  series,
  width = 180,
  height = 180,
  showDataLabels = false,
}: MultiSeriesPieProps) {
  const total = Math.max(
    series.reduce((sum, item) => sum + Math.max(0, item.value), 0),
    1
  );

  const chartData = {
    labels: ["Value", "Remaining"],
    datasets: series.map((item) => {
      const safeValue = Math.max(0, item.value);
      return {
        label: item.label,
        data: [safeValue, Math.max(total - safeValue, 0)],
        backgroundColor: [item.color, getLightRemainderColor(item.color)],
        borderWidth: 0,
        hoverOffset: 0,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "20%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: {
        display: showDataLabels
          ? (context: { dataIndex: number }) => context.dataIndex === 0
          : false,
        formatter: (value: number) => value,
        color: "#111827",
        font: {
          size: 11,
          weight: "600" as const,
        },
      },
    },
  };

  return (
    <div style={{ width: `${width}px`, height: `${height}px` }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
