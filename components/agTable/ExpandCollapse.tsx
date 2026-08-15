"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GridApi } from "ag-grid-community";
import { CopyMinus, CopyPlus } from "lucide-react";

interface ExpandCollapseToggleProps {
  gridApi: GridApi | null;
  clearDetailGridApis?: () => void;
}

const ExpandCollapse: React.FC<ExpandCollapseToggleProps> = ({
  gridApi,
  clearDetailGridApis,
}) => {
  const [allExpanded, setAllExpanded] = useState(false);
  const [hasMasterRows, setHasMasterRows] = useState(false);

  const areAllRowsExpanded = useCallback(() => {
    if (!gridApi) return false;

    let hasMaster = false;
    let expanded = true;

    gridApi.forEachNode((node) => {
      if (node.master) {
        hasMaster = true;
        if (!node.expanded) {
          expanded = false;
        }
      }
    });

    setHasMasterRows(hasMaster);
    return hasMaster && expanded;
  }, [gridApi]);

  useEffect(() => {
    if (!gridApi) return;

    const check = areAllRowsExpanded();
    setAllExpanded(check);

    const updateState = () => {
      setAllExpanded(areAllRowsExpanded());
    };

    gridApi.addEventListener("rowGroupOpened", updateState);
    gridApi.addEventListener("rowDataUpdated", updateState);

    return () => {
      gridApi.removeEventListener("rowGroupOpened", updateState);
      gridApi.removeEventListener("rowDataUpdated", updateState);
    };
  }, [areAllRowsExpanded, gridApi]);

  const toggleExpandCollapse = () => {
    if (!gridApi) return;

    const shouldExpand = !allExpanded;

    gridApi.forEachNode((node) => {
      if (node.master) {
        node.setExpanded(shouldExpand);
      }
    });

    setAllExpanded(shouldExpand);

    if (!shouldExpand && clearDetailGridApis) {
      clearDetailGridApis(); // clear detail grid APIs when collapsing
    }
  };

  if (!hasMasterRows) return null;

  return (
    <button
      onClick={toggleExpandCollapse}
      className="h-9 pr-4 flex items-center gap-1 cursor-pointer mr-4 min-w-[115px]"
    >
      {allExpanded ? (
        <>
          <CopyMinus strokeWidth={1} size={18} />
          Collapse All
        </>
      ) : (
        <>
          <CopyPlus strokeWidth={1} size={18} />
          Expand All
        </>
      )}
    </button>
  );
};

export default ExpandCollapse;
