"use client";

import React from 'react';

interface UserProgressData {
  totalItems: number;
  approvedCount: number;
  pendingCount: number;
  percentage: number;
}

interface UserProgressProps {
  progressData: UserProgressData;
  className?: string;
}

const UserProgress: React.FC<UserProgressProps> = ({ 
  progressData, 
  className = "" 
}) => {
  const { totalItems, approvedCount, pendingCount, percentage } = progressData;
  
  // Determine progress bar color based on completion
  const getProgressColor = () => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-white rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-white min-w-[3rem]">
          {percentage}%
        </span>
      </div>
    </div>
  );
};

export default UserProgress;
