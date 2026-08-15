'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { themeQuartz } from "ag-grid-community";

// Create a client-only wrapper that completely isolates ag-grid
const AgGridReact = dynamic(
  () => import('ag-grid-react').then((mod) => mod.AgGridReact),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-32 text-gray-500">Loading grid...</div>
  }
);

interface ClientOnlyAgGridProps {
  [key: string]: any;
}

export default function ClientOnlyAgGrid(props: ClientOnlyAgGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridApiRef = useRef<any>(null);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mergedProps = useMemo(() => {
    return {
      // Default to AG Grid Theming API theme.
      theme: props.theme ?? themeQuartz,
      ...props,
      onGridReady: (params: any) => {
        gridApiRef.current = params.api;

        // If the sidebar changes width after first render, columns can go stale.
        // We do an initial fit here and then again on container resize.
        try {
          params.api.sizeColumnsToFit();
        } catch {
          // ignore
        }

        if (typeof props.onGridReady === "function") {
          props.onGridReady(params);
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);

  useEffect(() => {
    if (!isClient) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      const api = gridApiRef.current;
      if (!api) return;
      try {
        api.sizeColumnsToFit();
      } catch {
        // ignore
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [isClient]);

  if (!isClient) {
    return <div className="flex items-center justify-center h-32 text-gray-500">Loading grid...</div>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <AgGridReact {...mergedProps} />
    </div>
  );
}
