'use client';
import { useState, useEffect, useRef } from 'react';

interface Tab {
  label: string;
  component: React.ComponentType;
  icon?: React.ElementType;
  iconOff?: React.ElementType;
}

interface TabsProps {
  tabs: Tab[];
  defaultIndex?: number;
  activeIndex?: number;
  onChange?: (index: number) => void;
  /** Optional content rendered at the end of the tab row (e.g. a "Clone Connector" button). */
  headerActions?: React.ReactNode;
}

const HorizontalTabs: React.FC<TabsProps> = ({
  tabs,
  defaultIndex = 0,
  activeIndex: controlledIndex,
  onChange,
  headerActions,
}) => {
  const isControlled = controlledIndex !== undefined;
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = isControlled ? controlledIndex : internalIndex;
  const ActiveComponent = tabs[activeIndex]?.component;
  
  // Force re-render when tabs change by using a key based on tabs reference
  const tabsKey = tabs.length > 0 ? `${activeIndex}-${tabs.map(t => t.label).join('-')}` : activeIndex;

  // Generate unique IDs for tabs and panels
  const tabId = (index: number) => `horizontal-tab-${index}`;
  const panelId = (index: number) => `horizontal-tabpanel-${index}`;

  const handleTabClick = (index: number) => {
    if (isControlled) {
      onChange?.(index);
    } else {
      setInternalIndex(index);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let newIndex = index;
    
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    handleTabClick(newIndex);
    // Focus the new tab
    setTimeout(() => {
      tabRefs.current[newIndex]?.focus();
    }, 0);
  };

  useEffect(() => {
    if (!isControlled) {
      setInternalIndex(defaultIndex);
    }
  }, [defaultIndex, isControlled]);

  return (
    <div className="w-full h-full flex flex-col min-w-0">
      {/* Tab Headers */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Tabs"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              ref={(el) => (tabRefs.current[index] = el)}
              role="tab"
              id={tabId(index)}
              aria-controls={panelId(index)}
              aria-selected={activeIndex === index}
              tabIndex={activeIndex === index ? 0 : -1}
              className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                index === activeIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                handleTabClick(index);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.icon && index === activeIndex ? (
                <tab.icon size={16} className="text-white" aria-hidden="true" />
              ) : tab.iconOff ? (
                <tab.iconOff size={16} className="text-gray-500" aria-hidden="true" />
              ) : null}
              {tab.label}
            </button>
          ))}
        </div>
        {headerActions}
      </div>

      {/* Active Tab Content */}
      <div 
        role="tabpanel"
        id={panelId(activeIndex)}
        aria-labelledby={tabId(activeIndex)}
        tabIndex={0}
        className="mt-4 flex-1 flex flex-col overflow-visible w-full min-w-0"
      >
        {ActiveComponent && <ActiveComponent key={tabsKey} />}
      </div>
    </div>
  );
};

export default HorizontalTabs;
