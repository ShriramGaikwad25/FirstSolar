"use client";

import React, { useCallback, useEffect, useState } from "react";
import { GridApi, RowNode } from "ag-grid-community";
import { CheckCircleIcon, DownloadIcon } from "lucide-react";

interface IndividualRowSelectionProps {
  gridApi: GridApi | null;
  detailGridApis: Map<string, GridApi>;
}

const IndividualRowSelection: React.FC<IndividualRowSelectionProps> = ({
  gridApi,
  detailGridApis,
}) => {
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
  }, [gridApi, detailGridApis]);

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
      {selectedCount > 0 && gridApi && (
        <>
          <button
            // onClick={handleSignOff}
            title="Sign Off"
            aria-label="Sign off selected rows"
            className="p-2 rounded transition-colors duration-200"
          >
            <CheckCircleIcon
              className="cursor-pointer"
              strokeWidth="1"
              size="24"
              color="#e73c3cff"
            />
          </button>
          <button
            title="Download Excel"
            aria-label="Download Excel for selected rows"
            className="p-2 rounded transition-colors duration-200"
          >
            <DownloadIcon 
              className="cursor-pointer" 
              strokeWidth="1" 
              size="24" 
            />
          </button>
        </>
      )}
    </div>
  );
};

export default IndividualRowSelection;
