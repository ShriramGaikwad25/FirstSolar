import { Check, X } from "lucide-react";
import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  iconEnable?: boolean
}

const ToggleSwitch: React.FC<ToggleSwitchProps> =React.memo( ({ checked, onChange, disabled, className, iconEnable}) => {
  const isChecked = checked ?? false;
  return (
    <label className={`relative inline-block w-12 h-6 cursor-pointer ${className ? className : ''}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={isChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      {/* Track */}
      <div className="absolute w-full mt-1 h-4 bg-gray-400 rounded-full peer-checked:bg-blue-300 transform transition-all"></div>
      {/* Thumb */}
      <div className="absolute top-0 left-0 w-6 h-6 bg-gray-100 border-gray-400 border peer-checked:border-0 peer-checked:bg-[#114295] rounded-full shadow-md transition-all peer-checked:translate-x-6  ">
         {iconEnable &&
          (isChecked ? <Check size={16} strokeWidth={4} className="scale-80" /> : <X size={16} strokeWidth={4} className="scale-80"/>)
        }
      </div> 
    </label>
  );
});

// Set display name for debugging
ToggleSwitch.displayName = "ToggleSwitch";
export default ToggleSwitch;
