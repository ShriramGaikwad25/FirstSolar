'use client';
import { useState, useRef, useEffect } from "react";

interface Tab {
  label: string;
  icon?: React.ElementType;
  iconOff?: React.ElementType;
  component: React.ComponentType;
}

interface TabsProps {
  tabs: Tab[];
  className?:string;
  buttonClass?:string;
  activeClass?:string;
  inactiveClass?:string;
  activeIndex?: number;
  onChange?: (index: number) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, className, buttonClass, activeClass, inactiveClass, activeIndex, onChange}) => {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState(0);
  const isControlled = typeof activeIndex === 'number';
  const activeTab = isControlled ? (activeIndex as number) : uncontrolledActiveTab;
  const ActiveComponent = tabs[activeTab]?.component; // Get active tab's component
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Generate unique IDs for tabs and panels
  const tabId = (index: number) => `tab-${index}`;
  const panelId = (index: number) => `tabpanel-${index}`;

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

    if (onChange) {
      onChange(newIndex);
    }
    if (!isControlled) {
      setUncontrolledActiveTab(newIndex);
    }
    // Focus the new tab
    setTimeout(() => {
      tabRefs.current[newIndex]?.focus();
    }, 0);
  };

  // Focus the active tab when component mounts or activeTab changes
  useEffect(() => {
    if (tabRefs.current[activeTab]) {
      tabRefs.current[activeTab]?.focus();
    }
  }, [activeTab]);

  return (
    <>
      {/* Tab Headers */}
      <div 
        ref={tabListRef}
        role="tablist" 
        aria-label="Tabs"
        className={`mb-4 flex gap-2 ${className}`}
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            ref={(el) => (tabRefs.current[index] = el)}
            role="tab"
            id={tabId(index)}
            aria-controls={panelId(index)}
            aria-selected={activeTab === index}
            tabIndex={activeTab === index ? 0 : -1}
            onClick={() => {
              if (onChange) {
                onChange(index);
              }
              if (!isControlled) {
                setUncontrolledActiveTab(index);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex items-center px-2 gap-2 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${buttonClass ? buttonClass : 'hover:text-blue-500'}
              ${activeTab === index ? (activeClass ? activeClass : 'border-b-4 -mb-0.5 border-blue-500 text-blue-600') : (inactiveClass ? inactiveClass : 'text-gray-500')}
              `}
          >
            <small className="flex gap-2">
           {tab.icon && activeTab === index ? <tab.icon size={16} aria-hidden="true" /> : tab.iconOff && <tab.iconOff size={16} aria-hidden="true" />}
            {tab.label}</small>
          </button>
        ))}
      </div>

      {/* Render Dynamic Component */}
      <div
        role="tabpanel"
        id={panelId(activeTab)}
        aria-labelledby={tabId(activeTab)}
        tabIndex={0}
      >
        {ActiveComponent && <ActiveComponent />}
      </div>
  
    </>
  );
};

export default Tabs;
