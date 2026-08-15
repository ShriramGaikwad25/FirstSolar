"use client";
import { RefObject, useState, useEffect, useRef } from "react";
import { Settings } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";
import { ColDef, GridApi } from "ag-grid-enterprise";
// Handle Drag End for Sorting
import { DragEndEvent } from "@dnd-kit/core";
interface ColumnSettingsProps {
  columnDefs: ColDef[];
  visibleColumns: () => string[];
  gridApi: GridApi | null;
  customButton?: React.ReactNode;
}

const ColumnSettings = ({
  columnDefs,
  gridApi,
  visibleColumns,
  customButton,
}: ColumnSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempColumnsOrder, setTempColumnsOrder] = useState(
    columnDefs.map((col) => col.field)
  );
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>([
    ...visibleColumns(),
  ]);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tempColumnsOrder.indexOf(active.id as string);
    const newIndex = tempColumnsOrder.indexOf(over.id as string);
    setTempColumnsOrder(arrayMove(tempColumnsOrder, oldIndex, newIndex));
  };

  // Toggle Column Visibility
  const toggleColumn = (field: string) => {
    setTempVisibleColumns((prev) =>
      prev.includes(field)
        ? prev.filter((col) => col !== field)
        : [...prev, field]
    );
  };

  const applyChanges = (newOrder: string[], newVisibility: string[]) => {
    if (gridApi) {
      const api = gridApi as GridApi;

      // Move Columns
      newOrder.forEach((field, index) => {
        api.moveColumns([field], index);
      });

      // Set Column Visibility
      newOrder.forEach((field) => {
        const isVisible = newVisibility.includes(field);
        api.setColumnsVisible([field], isVisible);
      });
    }
  };

  // Handle Apply (Save Changes)
  const handleApply = () => {
    applyChanges(
      tempColumnsOrder.filter((field): field is string => !!field),
      tempVisibleColumns
    );
    setIsOpen(false);
  };
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  return (
    <>
      {customButton ? (
        <div onClick={() => setIsOpen(!isOpen)}>
          {customButton}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Column Settings"
          className={`w-9 h-9 flex items-center s justify-center cursor-pointer rounded-sm hover:opacity-80 ${
            isOpen ? "bg-[#6D6E73]/20" : ""
          }`}
        >
          <Settings size="32" color="#35353A" className="transform scale-[.6]" />
        </button>
      )}
      {isOpen && (
        <div className="relative">
          <div
            ref={menuRef}
            className="absolute right-0 mt-4 bg-white shadow-lg px-3 rounded-md border border-gray-300 w-56 z-10"
          >
            <h3 className="h-10 items-center flex border-b border-gray-300 font-bold px-3 mb-2">
              Configure Table
            </h3>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={tempColumnsOrder.filter(
                  (field): field is string => !!field
                )}
                strategy={verticalListSortingStrategy}
              >
                {tempColumnsOrder
                  .filter((field): field is string => !!field)
                  .map((field) => {
                    const col = columnDefs.find((c) => c.field === field);
                    return col ? (
                      <SortableItem
                        key={`sortable-${field}`}
                        field={field}
                        col={{
                          ...col,
                          headerName: col.headerName || "Default Header",
                        }}
                        toggleColumn={toggleColumn}
                        isVisible={tempVisibleColumns.includes(field)}
                      />
                    ) : null;
                  })}
              </SortableContext>
            </DndContext>

            {/* Action Buttons */}
            <div className="flex justify-between mt-2 py-3 border-t border-gray-300 ">
              <button
                className="text-gray-600 px-3 py-2 rounded hover:bg-gray-200"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-[#15274E] text-white px-3 py-2 rounded hover:bg-[#15274E]/80 cursor-pointer"
                onClick={handleApply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ColumnSettings;
