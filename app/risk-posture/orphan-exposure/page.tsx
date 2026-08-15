'use client';

import React, { useEffect, useMemo, useState } from "react";
import { ColDef } from "ag-grid-community";
import { Download } from "lucide-react";
import AgGridReact from "@/components/AgGridWrapper";
import CustomPagination from "@/components/agTable/CustomPagination";

type OrphanExposureRawRow = {
  Account: string;
  Application: string;
  Entitlement: string;
  Description?: string;
  Risk?: string;
  "Last Login"?: string;
};

type OrphanExposureGridRow = {
  account: string;
  application: string;
  entitlement: string;
  description: string;
  risk: string;
  lastLogin: string;
};

const OrphanExposurePage = () => {
  const [rows, setRows] = useState<OrphanExposureGridRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const res = await fetch("/OrphanExposure.json");
        if (!res.ok) {
          throw new Error(`Failed to load /OrphanExposure.json (${res.status})`);
        }

        const rawJson = (await res.json()) as unknown;
        if (!Array.isArray(rawJson)) {
          throw new Error("OrphanExposure.json did not return an array");
        }

        const rawRows = rawJson as OrphanExposureRawRow[];
        const mapped: OrphanExposureGridRow[] = rawRows.map((r) => ({
          account: r.Account,
          application: r.Application,
          entitlement: r.Entitlement,
          description: r.Description ?? "",
          risk: r.Risk ?? "",
          lastLogin: r["Last Login"] ?? "",
        }));

        if (!cancelled) setRows(mapped);
      } catch (err) {
        if (!cancelled) setRows([]);
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalItems = rows.length;
  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [pageSize, totalItems]);

  const paginatedRows = useMemo(() => {
    if (pageSize === "all") return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  useEffect(() => {
    // If data loads and the current page is now out of range, clamp it.
    if (pageSize === "all") {
      setCurrentPage(1);
      return;
    }
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [pageSize, totalPages]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Account", field: "account", filter: true, sortable: true },
      { headerName: "Application", field: "application", filter: true, sortable: true },
      { headerName: "Entitlement", field: "entitlement", filter: true, sortable: true },
      { headerName: "Description", field: "description", filter: true, sortable: true, flex: 1.4 },
      { headerName: "Risk", field: "risk", filter: true, sortable: true, flex: 0.9 },
      { headerName: "Last Login", field: "lastLogin", filter: true, sortable: true, flex: 1.0 },
    ],
    []
  );

  const handleDownload = () => {
    if (!rows.length) return;

    const headers = ["Account", "Application", "Entitlement", "Description", "Risk", "Last Login"];
    const escapeCsv = (value: unknown) => {
      const str = value == null ? "" : String(value);
      // Escape double-quotes by doubling them
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escapeCsv(r.account),
          escapeCsv(r.application),
          escapeCsv(r.entitlement),
          escapeCsv(r.description),
          escapeCsv(r.risk),
          escapeCsv(r.lastLogin),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "OrphanExposure.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Orphan Exposure</h1>
          <p className="text-sm text-gray-600 mt-1">
            Orphaned accounts and their associated access.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading || rows.length === 0}
          className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Download orphan exposure as CSV"
          title="Download CSV"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="ag-theme-alpine w-full flex items-center justify-center text-sm text-gray-600">
          Loading orphan exposure data...
        </div>
      ) : (
        <div className="ag-theme-alpine w-full">
          {totalItems > 0 && (
            <div className="flex justify-center mb-2">
              <CustomPagination
                totalItems={totalItems}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={(newPage) => setCurrentPage(newPage)}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize ?? "all");
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100, "all"]}
              />
            </div>
          )}
          <AgGridReact
            rowData={paginatedRows}
            columnDefs={columnDefs}
            suppressCellFocus={true}
            domLayout="autoHeight"
          />
          {totalItems > 0 && (
            <div className="flex justify-center mt-2">
              <CustomPagination
                totalItems={totalItems}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={(newPage) => setCurrentPage(newPage)}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize ?? "all");
                  setCurrentPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100, "all"]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrphanExposurePage;

