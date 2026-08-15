"use client";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GridApi } from "ag-grid-enterprise";

export interface CustomPaginationProps {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number | "all";
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number | "all") => void;
  gridApi?: GridApi | null;
  pageSizeOptions?: Array<number | "all">;
}

const CustomPagination: React.FC<CustomPaginationProps> = ({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, "all"],
}) => {
  const safeTotalPages = totalPages > 0 ? totalPages : 1;

  const goToPage = (page: number) => {
    if (page < 1 || page > safeTotalPages) return;
    onPageChange(page);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const newPageSize = value === "all" ? "all" : parseInt(value, 10);
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  };

  const isAll = pageSize === "all";
  const numericPageSize = isAll ? totalItems || 0 : (pageSize as number);
  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * (numericPageSize || 1) + 1;
  const endRow = totalItems === 0 ? 0 : Math.min(currentPage * (numericPageSize || 1), totalItems);

  return (
    <div className="bg-white rounded-lg px-3 py-2 w-full border border-gray-200">
      <div className="flex justify-between items-center">
        {/* Prev Button - Left */}
        <button
          className={`flex items-center gap-1 text-sm ${
            currentPage === 1 ? "text-gray-400 cursor-not-allowed" : "text-gray-600 hover:text-gray-800 cursor-pointer"
          }`}
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </button>

        {/* Right cluster: Show entries then Next */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-600">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="text-sm border border-gray-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!onPageSizeChange}
              style={{ minWidth: '60px' }}
            >
              {pageSizeOptions.map((size) => {
                const val = size === "all" ? "all" : String(size);
                const label = size === "all" ? "All" : String(size);
                return (
                  <option key={val} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>
            {}
          </div>
          <button
            className={`flex items-center gap-1 text-sm ${
              currentPage >= safeTotalPages ? "text-gray-400 cursor-not-allowed" : "text-gray-600 hover:text-gray-800 cursor-pointer"
            }`}
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= safeTotalPages}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPagination;