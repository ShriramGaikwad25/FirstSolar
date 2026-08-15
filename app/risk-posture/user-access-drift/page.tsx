'use client';

import React, { useEffect, useMemo, useState } from "react";
import { ColDef } from "ag-grid-community";
import AgGridReact from "@/components/AgGridWrapper";

type UserAccessDriftRawRow = {
  Identity: string;
  Account: string;
  Application: string;
  Entitlement: string;
  "Drift Aging (Days)": string;
};

type UserAccessDriftGridRow = {
  identity: string;
  account: string;
  application: string;
  entitlement: string;
  driftAgingDays: number;
};

const UserAccessDriftPage = () => {
  const [rows, setRows] = useState<UserAccessDriftGridRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const res = await fetch("/UserAccessDrift.json");
        if (!res.ok) {
          throw new Error(`Failed to load /UserAccessDrift.json (${res.status})`);
        }

        const rawJson = (await res.json()) as unknown;
        if (!Array.isArray(rawJson)) {
          throw new Error("UserAccessDrift.json did not return an array");
        }

        const rawRows = rawJson as UserAccessDriftRawRow[];
        const mapped: UserAccessDriftGridRow[] = rawRows.map((r) => ({
          identity: r.Identity,
          account: r.Account,
          application: r.Application,
          entitlement: r.Entitlement,
          driftAgingDays: Number(r["Drift Aging (Days)"]) || 0,
        }));

        if (!cancelled) setRows(mapped);
      } catch (err) {
        // Keep the page usable even if the JSON fetch fails.
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

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Identity", field: "identity", filter: true, sortable: true, flex: 1 },
      { headerName: "Account", field: "account", filter: true, sortable: true, flex: 1 },
      { headerName: "Application", field: "application", filter: true, sortable: true, flex: 1.1 },
      { headerName: "Entitlement", field: "entitlement", filter: true, sortable: true, flex: 1.3 },
      { headerName: "Drift Aging (Days)", field: "driftAgingDays", filter: true, sortable: true, flex: 1, valueFormatter: (p) => String(p.value ?? "") },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          User Access Drift
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Users whose access has drifted from expected patterns.
        </p>
      </div>

      {isLoading ? (
        <div className="ag-theme-alpine w-full flex items-center justify-center text-sm text-gray-600">
          Loading drift data...
        </div>
      ) : (
        <div className="ag-theme-alpine w-full">
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            suppressCellFocus={true}
            domLayout="autoHeight"
          />
        </div>
      )}
    </div>
  );
};

export default UserAccessDriftPage;

