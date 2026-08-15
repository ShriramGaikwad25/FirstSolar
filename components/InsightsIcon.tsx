"use client";

import React from "react";
import { Lightbulb } from "lucide-react";

interface InsightsIconProps {
  className?: string;
  size?: number;
}

/**
 * Light bulb icon for AI Insights - uses Lucide Lightbulb.
 */
export function InsightsIcon({ className = "", size = 24 }: InsightsIconProps) {
  return <Lightbulb size={size} className={className} aria-hidden />;
}

export default InsightsIcon;
