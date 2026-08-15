"use client";

import { Suspense, useEffect } from "react";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import NhiReviewContent from "./NhiReviewContent";

export default function NhiQ3ProductionReviewPage() {
  const { hideSidebar, showSidebar } = useLeftSidebar();
  useEffect(() => {
    hideSidebar();
    return () => showSidebar();
  }, [hideSidebar, showSidebar]);

  return (
    <Suspense fallback={<div className="p-6 text-gray-500 text-sm">Loading…</div>}>
      <NhiReviewContent />
    </Suspense>
  );
}
