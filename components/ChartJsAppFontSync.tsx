"use client";

import { useLayoutEffect } from "react";
import { Chart as ChartJS } from "chart.js";

/** Matches Chart.js canvas text to the root layout font (e.g. next/font Inter on body). */
export function ChartJsAppFontSync() {
  useLayoutEffect(() => {
    const family = window.getComputedStyle(document.body).fontFamily;
    if (family) ChartJS.defaults.font.family = family;
  }, []);
  return null;
}
