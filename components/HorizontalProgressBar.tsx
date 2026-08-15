import React from "react";

interface HorizontalProgressBarProps {
  value: number; // Progress value (0-100)
  height?: number; // Height of the progress bar in pixels
  showPercentage?: boolean; // Whether to show percentage text
  className?: string; // Additional CSS classes
}

const HorizontalProgressBar: React.FC<HorizontalProgressBarProps> = ({
  value,
  height = 8,
  showPercentage = true,
  className = ""
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className="bg-gray-200 rounded-full overflow-hidden"
        style={{ height: `${height}px`, width: '80px' }}
      >
        <div
          className="bg-blue-500 h-full transition-all duration-300 ease-in-out rounded-full"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-gray-600 font-medium min-w-[3ch]">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
};

export default HorizontalProgressBar;
