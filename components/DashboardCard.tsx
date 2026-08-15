"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  flipDescription?: string;
  color?: "blue" | "green" | "purple" | "indigo" | "orange" | "gray";
}

const colorClasses = {
  blue: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
  purple: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
  indigo: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
  orange: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
  gray: {
    bg: "bg-green-50",
    icon: "text-green-600",
    border: "border-green-200",
  },
};

export default function DashboardCard({
  title,
  href,
  icon: Icon,
  description,
  flipDescription,
  color = "blue",
}: DashboardCardProps) {
  const colors = colorClasses[color];

  return (
    <Link
      href={href}
      className={`card bg-white rounded-lg shadow-md p-6 border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${colors.border} h-56 block`}
    >
      <div className="card-inner h-full">
        <div className="card-front h-full flex items-center justify-center">
          <div className="flex flex-col items-center text-center space-y-4 w-full">
            <div
              className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-6 h-6 ${colors.icon}`} />
            </div>
            <div className="w-full">
              <h3 className="text-sm font-semibold text-blue-600 mb-1">
                {title}
              </h3>
              <p className="text-xs text-gray-600 px-1">{description}</p>
            </div>
          </div>
        </div>
        <div className="card-back h-full flex items-center justify-center p-6">
          <div className="flex flex-col items-center justify-center text-center w-full">
            <Icon className={`w-12 h-12 ${colors.icon} mb-4`} />
            {flipDescription ? (
              <p className="text-xs text-gray-700 leading-relaxed px-4">
                {flipDescription}
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600 font-medium">
                  Click to open
                </p>
                <p className="text-xs text-blue-600 mt-2">{title}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

