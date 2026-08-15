"use client";

import React from 'react';

interface ProgressData {
  totalItems: number;
  approvedCount: number;
  pendingCount: number;
  revokedCount: number;
  delegatedCount: number;
  remediatedCount: number;
}

interface CertificationProgressProps {
  progressData: ProgressData;
  className?: string;
}

const CertificationProgress: React.FC<CertificationProgressProps> = ({ 
  progressData, 
  className = "" 
}) => {
  const { totalItems, approvedCount, pendingCount, revokedCount, delegatedCount, remediatedCount } = progressData;
  
  // Calculate completion percentage
  const completedCount = approvedCount + revokedCount + delegatedCount + remediatedCount;
  const completionPercentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  
  // Determine progress bar color based on completion
  const getProgressColor = () => {
    if (completionPercentage >= 80) return 'bg-green-500';
    if (completionPercentage >= 60) return 'bg-blue-500';
    if (completionPercentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 min-w-[3rem]">
          {completionPercentage}%
        </span>
      </div>
    </div>
  );
};

export default CertificationProgress;
