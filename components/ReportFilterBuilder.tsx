"use client";
import {
  Control,
  FieldValues,
  UseFormSetValue,
  UseFormWatch,
  useWatch,
} from "react-hook-form";
import { CircleX, Plus } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { Controller } from "react-hook-form";
import Select from "react-select";
import { v4 as uuidv4 } from "uuid";

const operators = [
  { label: "Equals", value: "=" },
  { label: "Not Equals", value: "not_equals" },
  { label: "Contains", value: "contains" },
  { label: "Excludes", value: "excludes" },
  { label: "IN", value: "in" },
  { label: "NOT IN", value: "not_in" },
];

const logicalOperators = [
  { label: "AND", value: "AND" },
  { label: "OR", value: "OR" },
];

interface Condition {
  id: string;
  attribute: { label: string; value: string } | null;
  operator: { label: string; value: string } | null;
  value: string;
  logicalOp: string;
}

interface ReportFilterBuilderProps {
  title?: string;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
  fieldName: string;
  attributesOptions?: { label: string; value: string }[];
}

const ReportFilterBuilder: React.FC<ReportFilterBuilderProps> = ({
  title,
  control,
  setValue,
  fieldName,
  attributesOptions,
}) => {
  const watchedConditions = useWatch({ control, name: fieldName });
  const conditions: Condition[] = useMemo(() => {
    return Array.isArray(watchedConditions) ? watchedConditions : [];
  }, [watchedConditions]);

  useEffect(() => {
    if (!Array.isArray(watchedConditions)) {
      setValue(fieldName, [], { shouldDirty: true });
    } else if (watchedConditions.length === 0) {
      // Add first condition by default
      const firstCondition: Condition = {
        id: uuidv4(),
        attribute: null,
        operator: null,
        value: "",
        logicalOp: "AND",
      };
      setValue(fieldName, [firstCondition], { shouldDirty: false });
    }
  }, [watchedConditions, setValue, fieldName]);

  const addCondition = () => {
    const newCondition: Condition = {
      id: uuidv4(),
      attribute: null,
      operator: null,
      value: "",
      logicalOp: "AND",
    };

    setValue(fieldName, [...conditions, newCondition], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const removeCondition = (id: string) => {
    setValue(
      fieldName,
      conditions.filter((cond) => cond.id !== id),
      { shouldDirty: true, shouldValidate: true }
    );
  };

  return (
    <>
      {title && <h3 className="font-bold mb-2">{title}</h3>}
      <div className="p-3 border rounded-md w-full border-gray-300 relative">
        <div className="space-y-2">
          {conditions.map((condition, index) => (
              <div
                key={condition.id}
                className="flex space-x-2 items-center"
              >
                  {index > 0 && (
                    <>
                      <Controller
                        name={`${fieldName}.${index}.logicalOp`}
                        control={control}
                        defaultValue="AND"
                        render={({ field }) => (
                          <>
                            <input type="hidden" {...field} value="AND" />
                            <div className="px-3 py-1.5 text-gray-700 font-medium flex-shrink-0">
                              AND
                            </div>
                          </>
                        )}
                      />
                    </>
                  )}

                  <Controller
                    name={`${fieldName}.${index}.attribute`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={attributesOptions}
                        isSearchable={false}
                        placeholder="Select Attribute"
                        className="flex-1"
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: "32px",
                          }),
                        }}
                      />
                    )}
                  />

                  <Controller
                    name={`${fieldName}.${index}.operator`}
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={operators}
                        isSearchable={false}
                        placeholder="Condition"
                        className="flex-1"
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: "32px",
                          }),
                        }}
                      />
                    )}
                  />

                  <Controller
                    name={`${fieldName}.${index}.value`}
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Enter value"
                        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  />

                  <button
                    type="button"
                    onClick={() => removeCondition(condition.id)}
                    className="text-red-500 cursor-pointer hover:text-red-700 transition-colors flex-shrink-0"
                    title="Remove condition"
                  >
                    <CircleX size={20} />
                  </button>
              </div>
            ))}

          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={addCondition}
              className="bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer hover:bg-blue-600 transition-colors font-medium text-sm"
            >
              <Plus size={14} /> Add Condition
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportFilterBuilder;

