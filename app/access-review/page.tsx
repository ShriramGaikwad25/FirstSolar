"use client";
import React, { useState } from "react";
import HorizontalTabs from "@/components/HorizontalTabs";
import OpenTab from "./OpenTab";
import CompleteTab from "./CompleteTab";
import { ChevronUp, ChevronDown } from "lucide-react";
import { formatDateMMDDYY as formatDateShared } from "@/utils/utils";

// Re-export the date formatter for other components that depend on it
export const formatDateMMDDYY = (dateString?: string) =>
  formatDateShared(dateString);

const AccessReview: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: "Open",
      component: OpenTab,
      icon: ChevronDown,
      iconOff: ChevronUp,
    },
    {
      label: "Complete", 
      component: CompleteTab,
      icon: ChevronDown,
      iconOff: ChevronUp,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold mb-3 border-b border-gray-300 pb-2 text-blue-950">
        Access Review
      </h1>
      
      <HorizontalTabs
        tabs={tabs}
        activeIndex={activeTab}
        onChange={setActiveTab}
      />
    </>
  );
};

export default AccessReview;