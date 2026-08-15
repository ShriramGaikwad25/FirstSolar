import React from "react";
import { PolarArea } from "react-chartjs-2";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  RadialLinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);

interface PolarAreaRiskChartItem {
  label: string;
  value: number;
  color: string;
}

interface PolarAreaRiskChartProps {
  data: PolarAreaRiskChartItem[];
  width?: number;
  height?: number;
}

export default function PolarAreaRiskChart({
  data,
  width = 220,
  height = 220,
}: PolarAreaRiskChartProps) {
  const chartData = {
    labels: data.map((item) => item.label),
    datasets: [
      {
        data: data.map((item) => item.value),
        backgroundColor: data.map((item) => item.color),
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: { display: false },
    },
    scales: {
      r: {
        ticks: { display: false },
        grid: { color: "#E5E7EB" },
        angleLines: { color: "#E5E7EB" },
        pointLabels: { display: false },
      },
    },
  };

  return (
    <div style={{ width: `${width}px`, height: `${height}px` }}>
      <PolarArea data={chartData} options={options} />
    </div>
  );
}
