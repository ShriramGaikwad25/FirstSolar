'use client';
import { useState } from 'react';

interface Segment {
  label: string;
  component: React.ComponentType;
}

interface SegmentedControlProps {
  segments: Segment[];
  defaultIndex?: number;
  activeIndex?: number;
  onChange?: (index: number) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  segments,
  defaultIndex = 0,
  activeIndex: controlledIndex,
  onChange,
}) => {
  const isControlled = controlledIndex !== undefined;
  const [internalIndex, setInternalIndex] = useState(defaultIndex);

  const activeIndex = isControlled ? controlledIndex : internalIndex;
  const ActiveComponent = segments[activeIndex].component;

  const handleSegmentClick = (index: number) => {
    if (isControlled) {
      onChange?.(index);
    } else {
      setInternalIndex(index);
    }
  };

  return (
    <div className="w-full">
      {/* Segmented Control */}
      <div className="flex items-center justify-end mb-4">
        {/* Segmented control container */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {segments.map((segment, index) => (
            <button
              key={index}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                index === activeIndex
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => handleSegmentClick(index)}
            >
              {segment.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Segment Content */}
      <div>
        <ActiveComponent />
      </div>
    </div>
  );
};

export default SegmentedControl;
