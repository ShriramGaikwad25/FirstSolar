"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GridApi, RowNode } from "ag-grid-community";
import ActionButtons from "./ActionButtons";
import ExpandCollapse from "./ExpandCollapse";
import { CheckCircleIcon, DownloadIcon } from "lucide-react";

interface SelectAllProps {
  gridApi: GridApi | null;
  detailGridApis: Map<string, GridApi>;
  clearDetailGridApis: () => void;
  showExpandCollapse?: boolean; // <-- Optional prop
}

const SelectAllAR: React.FC<SelectAllProps> = ({
  gridApi,
  detailGridApis,
  clearDetailGridApis,
  showExpandCollapse = true, // default to true
}) => {
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  const updateSelectedCount = useCallback(() => {
    if (!gridApi) return;

    let totalVisible = 0;
    let totalSelected = 0;

    const visibleMasterNodes: RowNode[] = [];
    gridApi.forEachNodeAfterFilter((node) => {
      visibleMasterNodes.push(node as RowNode);
    });

    totalVisible += visibleMasterNodes.length;
    totalSelected += visibleMasterNodes.filter((node) =>
      node.isSelected()
    ).length;

    detailGridApis.forEach((detailApi) => {
      const visibleRows: RowNode[] = [];
      detailApi.forEachNodeAfterFilter((node) =>
        visibleRows.push(node as RowNode)
      );
      totalVisible += visibleRows.length;

      const selectedNodes = detailApi.getSelectedNodes?.();
      totalSelected += Array.isArray(selectedNodes) ? selectedNodes.length : 0;
    });

    setVisibleCount(totalVisible);
    setSelectedCount(totalSelected);

    setIsAllSelected(totalSelected === totalVisible && totalVisible > 0);
    setIsIndeterminate(totalSelected > 0 && totalSelected < totalVisible);
  }, [gridApi, detailGridApis]);

  const toggleSelectAll = () => {
    if (!gridApi) return;

    const shouldSelect = !isAllSelected;

    // Select/Deselect master rows
    gridApi.forEachNodeAfterFilter((node) => {
      node.setSelected(shouldSelect);
    });

    // Select/Deselect detail rows
    detailGridApis.forEach((detailApi) => {
      detailApi.forEachNodeAfterFilter((node) => {
        node.setSelected(shouldSelect);
      });
    });

    updateSelectedCount();
  };

  useEffect(() => {
    if (!gridApi) return;

    updateSelectedCount();

    const listener = () => updateSelectedCount();

    gridApi.addEventListener("selectionChanged", listener);
    gridApi.addEventListener("paginationChanged", listener);
    gridApi.addEventListener("rowDataUpdated", listener);
    gridApi.addEventListener("rowGroupOpened", listener);

    return () => {
      gridApi.removeEventListener("selectionChanged", listener);
      gridApi.removeEventListener("paginationChanged", listener);
      gridApi.removeEventListener("rowDataUpdated", listener);
      gridApi.removeEventListener("rowGroupOpened", listener);
    };
  }, [gridApi, updateSelectedCount]);

  return (
    <div className="flex items-center text-sm">
      <div className="divide-x-1 divide-gray-300 h-9 flex items-center">
        {showExpandCollapse && <ExpandCollapse gridApi={gridApi} />}

        <label className="font-medium cursor-pointer pr-4 items-center h-9 flex">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isIndeterminate;
            }}
            onChange={toggleSelectAll}
            className="mr-2 w-4 h-4 cursor-pointer"
          />
          Select All
        </label>

        {}
      </div>

      {selectedCount > 0 && gridApi && (
        <>
                <button
          // onClick={handleSignOff}
          title="Sign Off"
          aria-label="Sign off selected rows"
          className="p-2 rounded transition-colors duration-200"
        >
          <CheckCircleIcon
            className="curser-pointer"
            strokeWidth="1"
            size="24"
            color="#e73c3cff"
          />
        </button>
        <button
          title="Download Excel"
          aria-label="Sign off selected rows"
          className="p-2 rounded transition-colors duration-200"
        >
          <DownloadIcon className="curser-pointer" strokeWidth="1" size="24" />
        </button>
        </>
      )}
    </div>
  );
};

export default SelectAllAR;
