"use client";

import { useEffect } from "react";

/**
 * Plain HTML tables: a hovered cell shows its text as the browser tooltip.
 * Cells that already have a title, hold controls, or sit inside an AG Grid (which has its own
 * tooltips, see lib/ag-grid-setup) are left alone.
 */
export function TableCellHoverTitles() {
  useEffect(() => {
    const onMouseOver = (e: MouseEvent) => {
      const cell = (e.target as Element | null)?.closest?.("td, th");
      if (!(cell instanceof HTMLElement) || cell.hasAttribute("title") || cell.closest(".ag-root-wrapper")) return;
      if (cell.querySelector("input, select, textarea, button, [title]")) return;
      const text = cell.innerText.replace(/\s+/g, " ").trim();
      if (text) cell.setAttribute("title", text);
    };
    document.addEventListener("mouseover", onMouseOver);
    return () => document.removeEventListener("mouseover", onMouseOver);
  }, []);
  return null;
}
