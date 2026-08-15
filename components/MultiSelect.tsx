'use client';
import React, { JSX, useEffect, useState } from "react";
import dynamic from 'next/dynamic';
const Select = dynamic(() => import('react-select'), { ssr: false });
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import AsyncSelect from "react-select/async";
import { GroupBase, OptionProps, components as component } from "react-select";
import Image from 'next/image';
import Creatable from 'react-select/creatable'; 
import AsyncCreatable from 'react-select/async-creatable'; 

type MultiSelectProps<T extends FieldValues = FieldValues> = {
  control: Control<FieldValues>;
  name: Path<T>;
  options?: { value: string; label: string; image?: string }[];
  isAsync?: boolean;
  loadOptions?: (inputValue: string, callback: (options: { value: string; label: string; image?: string }[]) => void) => void;
  placeholder?: string;
  className?: string;
  components?: Record<string, unknown>;
  isMulti?: boolean;
  isSearchable?: boolean;
  defaultValue?: { value: string; label: string; image?: string }[];
  isDisabled?: boolean;
  optionCheck?: boolean;
  isCreatable?: boolean;  // Add this prop to enable creatable functionality
}
function MultiSelect<FormValues extends FieldValues>({  
  name,
  control,
  options = [],
  isAsync = false,
  loadOptions,
  placeholder = "Select...",
  className,
  components,
  isMulti = true,
  isSearchable = true,
  defaultValue,
  isDisabled = false,
  optionCheck = false,
  isCreatable = false,  // Default to false
}: MultiSelectProps<FormValues>) {
  // Fix SSR hydration issues by ensuring it's a client-only component
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  
  // Show a placeholder input during SSR to prevent layout shift
  if (!isClient) {
    return (
      <div className="w-full">
        <div className="px-3 py-2 text-sm border border-gray-300 rounded bg-white min-h-[38px] flex items-center text-gray-400">
          {placeholder}
        </div>
      </div>
    );
  }
  
  interface CustomOptionProps extends OptionProps<unknown, boolean, GroupBase<unknown>> {
    image?: string;
  }
  const Option = (props: JSX.IntrinsicAttributes & CustomOptionProps) => {
    return (
      <component.Option {...props} className="!flex items-center">
        <input
          type="checkbox"
          checked={props.isSelected}
          readOnly
          style={{ marginRight: "8px" }}
        />
        {"image" in (props.data as Record<string, unknown>) && (
          <Image
            src={(props.data as { image: string }).image}
            alt={props.label}
            width={32} 
            height={32}
            className="rounded-full mr-2"
          />
        )}
        <label>{props.label}</label>
      </component.Option>
    );
  };


  return (
    <Controller
      name={name as Path<FormValues>}
      control={control}
      render={({ field }) => {
        const handleChange = (newValue: unknown) => {
          if (isMulti) {
            field.onChange(newValue || []);
          } else {
            const selected = newValue as { value: string; label: string } | null;
            field.onChange(selected ? selected.value : "");
          }
        };

        
       // Handle custom value creation when using Creatable
        const handleCreate = (inputValue: string) => {

          // Check if there is already a custom value added
          if (field.value && field.value.length > 0) {
            // If there is already a custom value, prevent adding another one
            // Or you can replace the old custom value with the new one if desired:
            const updatedValue = [{ value: inputValue, label: inputValue }]; // Replace the existing value with the new one
            field.onChange(updatedValue); // Update the form state
            return updatedValue;
          }

          // If no custom value exists, just add the new custom value
          const updatedValue = [{ value: inputValue, label: inputValue }];
          field.onChange(updatedValue); // Update the form state
          return updatedValue;
        };

        const selectedValue = isMulti
          ? field.value || []
          : options.find((opt) => opt.value === field.value) || null;

        // Use Creatable if isCreatable is true
        if (isCreatable) {
          return isAsync ? (
            <AsyncCreatable
              {...field}
              instanceId={name}
              isMulti={isMulti}
              cacheOptions
              defaultOptions
              isSearchable={isSearchable}
              loadOptions={loadOptions}
              placeholder={placeholder}
              onChange={handleChange}
              value={selectedValue ? selectedValue : defaultValue}
              components={optionCheck && isMulti ? { ...components, Option } : components}
              className={className}
              isDisabled={isDisabled}
              hideSelectedOptions={false}
              closeMenuOnSelect={isMulti ? false : true}
              menuPlacement="auto"
              onCreateOption={handleCreate}  
              formatCreateLabel={(inputValue) => `custom value: "${inputValue}"`} 
            />
          ) : (
            <Creatable
              {...field}
              isMulti={isMulti}
              instanceId={name}
              isSearchable={isSearchable}
              options={options}
              placeholder={placeholder}
              onChange={handleChange}
              value={selectedValue ? selectedValue : defaultValue}
              components={optionCheck && isMulti ? { ...components, Option } : components}
              className={className}
              isDisabled={isDisabled}
              hideSelectedOptions={false}
              closeMenuOnSelect={isMulti ? false : true}
              menuPlacement="auto"
              onCreateOption={handleCreate}  
              formatCreateLabel={(inputValue) => `custom value: "${inputValue}"`} 
            />
          );
        }

        // Default behavior: Standard select or AsyncSelect
        return isAsync ? (
          <AsyncSelect
            {...field}
            instanceId={name}
            isMulti={isMulti}
            cacheOptions
            defaultOptions
            isSearchable={isSearchable}
            loadOptions={loadOptions}
            placeholder={placeholder}
            onChange={handleChange}
            value={selectedValue ? selectedValue : defaultValue}
            components={optionCheck && isMulti ? { ...components, Option } : components}
            className={className}
            isDisabled={isDisabled}
            hideSelectedOptions={false}
            closeMenuOnSelect={isMulti ? false : true}
            menuPlacement="auto"
          />
        ) : (
          <Select
            {...field}
            isMulti={isMulti}
            instanceId={name}
            isSearchable={isSearchable}
            options={options}
            placeholder={placeholder}
            onChange={handleChange}
            value={selectedValue ? selectedValue : defaultValue}
            components={optionCheck && isMulti ? { ...components, Option } : components}
            className={className}
            isDisabled={isDisabled}
            hideSelectedOptions={false}
            closeMenuOnSelect={isMulti ? false : true}
            menuPlacement="auto"
          />
        );
      }}
    />
  );
};

export default MultiSelect;
