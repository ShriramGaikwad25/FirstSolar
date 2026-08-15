import React, { useState, useRef, useEffect } from "react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import CreatableSelect from "react-select/creatable";
import { components, MenuListProps } from "react-select";

type Option = {
  value: string;
  label: string;
};

type CustomMultiSelectBeforeEscalationProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  options?: Option[];
  placeholder?: string;
  isDisabled?: boolean;
};

export default function CustomMultiSelectBeforeEscalation<T extends FieldValues>({
  control,
  name,
  options = [],
  placeholder = "Select...",
  isDisabled = false,
}: CustomMultiSelectBeforeEscalationProps<T>) {
  const [internalOptions, setInternalOptions] = useState<Option[]>(options);
  const [inputDays, setInputDays] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Refs for main select container & input inside dropdown
  const selectRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDocumentMouseDown(event: MouseEvent) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node) &&
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  const isValidDays = /^\d+$/.test(inputDays);

  const CustomMenuList = (props: MenuListProps<Option, true>) => {
    const selected = (props.selectProps.value as Option[]) || [];

    const addOption = () => {
      if (!isValidDays) return;

      const newOption = {
        value: `${inputDays} days before escalation`,
        label: `${inputDays} days before escalation`,
      };

      if (!internalOptions.find((opt) => opt.value === newOption.value)) {
        setInternalOptions((prev) => [...prev, newOption]);
      }

      props.selectProps.onChange?.([...selected, newOption], {
        action: "select-option",
        option: newOption,
      });

      setInputDays("");
      setMenuOpen(true); // keep menu open after adding
    };

    return (
      <components.MenuList {...props}>
        {props.children}
        <div
          ref={inputWrapperRef}
          className="border-t border-gray-300 flex items-center gap-2 p-3 bg-white sticky bottom-0 z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* <span>every</span> */}
          <input
            type="number"
            min={1}
            value={inputDays}
            onChange={(e) => {
              const val = e.target.value;
              // allow empty string or digits only
              if (/^\d*$/.test(val)) {
                setInputDays(val);
              }
            }}
            className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
            placeholder="Days"
            onKeyDown={(e) => e.stopPropagation()}
          />
          <span>days before escalation</span>
          <button
            disabled={!isValidDays}
            onClick={addOption}
            className={`ml-auto px-3 py-1 rounded text-white text-sm ${
              isValidDays
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                : "bg-gray-300 cursor-not-allowed"
            }`}
            type="button"
          >
            Add
          </button>
        </div>
      </components.MenuList>
    );
  };

  // Transform existing options to include "before escalation" format
  const transformedOptions = internalOptions.map(opt => {
    // If option already has "before escalation", keep it as is
    if (opt.label.toLowerCase().includes("before escalation")) {
      return opt;
    }
    // Transform "before X Days" to "every X days before escalation"
    const match = opt.label.match(/before (\d+) Days?/i);
    if (match) {
      const days = match[1];
      return {
        value: `every ${days} days before escalation`,
        label: `every ${days} days before escalation`,
      };
    }
    // For other formats, try to extract number and format
    const numberMatch = opt.label.match(/(\d+)/);
    if (numberMatch) {
      const days = numberMatch[1];
      return {
        value: `every ${days} days before escalation`,
        label: `every ${days} days before escalation`,
      };
    }
    return opt;
  });

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        // Transform field value to include "before escalation" format
        const transformedValue = field.value?.map((val: Option) => {
          if (!val) return val;
          // If already formatted, return as is
          if (val.label?.toLowerCase().includes("before escalation")) {
            return val;
          }
          // Transform the label
          const match = val.label?.match(/before (\d+) Days?/i) || val.label?.match(/(\d+)/);
          if (match) {
            const days = match[1];
            return {
              ...val,
              label: `every ${days} days before escalation`,
              value: val.value || `every ${days} days before escalation`,
            };
          }
          return val;
        }) || [];

        return (
          <div ref={selectRef}>
            <CreatableSelect
              isMulti
              isDisabled={isDisabled}
              placeholder={placeholder}
              options={transformedOptions}
              value={transformedValue}
              onChange={(newValue) => {
                // Store the transformed value
                field.onChange(newValue);
              }}
              onMenuOpen={() => setMenuOpen(true)}
              menuIsOpen={menuOpen}
              onBlur={field.onBlur}
              classNamePrefix="react-select"
              components={{ MenuList: CustomMenuList }}
            />
          </div>
        );
      }}
    />
  );
}

