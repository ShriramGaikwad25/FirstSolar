"use client";
import {
  Control,
  FieldValues,
  UseFormSetValue,
  UseFormWatch,
  useWatch,
} from "react-hook-form";
import { CircleX, Plus } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import Select from "react-select";
import { v4 as uuidv4 } from "uuid";
import Accordion from "./Accordion";
import { buildNestedExpression } from "@/utils/expressionBuilder";

const attributes = [
  { label: "User Role", value: "user_role" },
  { label: "Department", value: "department" },
  { label: "Location", value: "location" },
  { label: "Access Level", value: "access_level" },
  { label: "Status", value: "status" },
  { label: "Job Title", value: "job_title" },
];

const operators = [
  { label: "Equals", value: "equals" },
  { label: "Not Equals", value: "not_equals" },
  { label: "Contains", value: "contains" },
  { label: "Excludes", value: "excludes" },
  { label: "IN", value: "in" },
  { label: "NOT IN", value: "not_in" },
];

const defaultLogicalOperators = [
  { label: "AND", value: "AND" },
  { label: "OR", value: "OR" },
];

/** react-select: full width, readable option text, portal above modals/footers */
const selectStyles = {
  container: (base: object) => ({ ...base, width: "100%", minWidth: 0 }),
  control: (base: object) => ({
    ...base,
    width: "100%",
    minWidth: 0,
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
    color: "#111827",
  }),
  menuPortal: (base: object) => ({ ...base, zIndex: 10000 }),
  menu: (base: object) => ({
    ...base,
    zIndex: 10000,
    backgroundColor: "#ffffff",
  }),
  menuList: (base: object) => ({ ...base, backgroundColor: "#ffffff" }),
  option: (base: object, state: { isFocused: boolean; isSelected: boolean }) => ({
    ...base,
    color: "#111827",
    backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f3f4f6" : "#ffffff",
  }),
  singleValue: (base: object) => ({ ...base, color: "#111827" }),
  input: (base: object) => ({ ...base, color: "#111827" }),
  placeholder: (base: object) => ({ ...base, color: "#6b7280" }),
};

interface Condition {
  id: string;
  attribute: { label: string; value: string } | null;
  operator: { label: string; value: string } | null;
  value: string;
  logicalOp: string;
}

interface ExpressionBuilderProps {
  title?: string;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
  fieldName: string;
  attributesOptions?: { label: string; value: string }[];
  /** Optional override for logical operators (defaults to AND/OR) */
  logicalOperatorOptions?: { label: string; value: string }[];
  hideJsonPreview?: boolean;
  fullWidth?: boolean;
}

const ExpressionBuilder: React.FC<ExpressionBuilderProps> = ({
  title,
  control,
  setValue,
  fieldName,
  attributesOptions,
  logicalOperatorOptions,
  hideJsonPreview = false,
  fullWidth = false,
}) => {
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setMenuPortalTarget(document.body);
  }, []);

  const watchedConditions = useWatch({ control, name: fieldName });
  const conditions: Condition[] = useMemo(() => {
    if (!Array.isArray(watchedConditions)) return [];
    // Ensure all conditions have an id
    return watchedConditions.map((cond, index) => ({
      ...cond,
      id: cond.id || `condition-${index}-${Date.now()}`,
    }));
  }, [watchedConditions]);

  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // <-- Sidebar State
  // (Reverted) No global shift behavior

  const effectiveLogicalOperators = logicalOperatorOptions ?? defaultLogicalOperators;
  const defaultLogicalOpValue =
    effectiveLogicalOperators[0]?.value ?? defaultLogicalOperators[0].value;

  useEffect(() => {
    if (conditions.length > 0) {
      setIsAccordionOpen(true);
    }
  }, [conditions]);

  useEffect(() => {
    if (!Array.isArray(conditions)) {
      setValue(fieldName, [], { shouldDirty: true });
    }
  }, [conditions, setValue, fieldName]);

  const addCondition = () => {
    const newCondition: Condition = {
      id: uuidv4(),
      attribute: null,
      operator: null,
      value: "",
      logicalOp: defaultLogicalOpValue,
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

  const formattedExpression = conditions.map((cond) => ({
    attribute: cond.attribute?.value || "",
    operator: cond.operator?.value || "",
    value: cond.value || "",
    logicalOp: cond.logicalOp || "",
  }));

  const nestedExpression = buildNestedExpression(conditions);

  return (
    <>
      {title && <h3 className="font-bold">{title}</h3>}
      <div className={`p-4 border rounded-md border-gray-300 relative ${fullWidth ? 'w-full min-w-0' : 'w-full max-w-2xl'}`}>
        {conditions.map((condition, index) => (
          <div
            key={condition.id || `expr-${index}`}
            className="flex gap-3 items-center w-full mb-2 last:mb-0"
          >
            {/* Spacer so first row aligns with rows that have AND/OR */}
            {index === 0 ? (
              <div className="flex-shrink-0 w-28" aria-hidden />
            ) : (
              <div className="flex-shrink-0 w-28 min-w-28">
                <Controller
                  name={`${fieldName}.${index}.logicalOp`}
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      options={effectiveLogicalOperators}
                      isSearchable={false}
                      placeholder={
                        effectiveLogicalOperators.length === 1
                          ? effectiveLogicalOperators[0].label
                          : "AND/OR"
                      }
                      styles={selectStyles}
                      menuPortalTarget={menuPortalTarget ?? undefined}
                      menuPosition="fixed"
                    />
                  )}
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <Controller
                name={`${fieldName}.${index}.attribute`}
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={attributesOptions ?? attributes}
                    isSearchable={false}
                    placeholder="Select Attribute"
                    styles={selectStyles}
                    menuPortalTarget={menuPortalTarget ?? undefined}
                    menuPosition="fixed"
                  />
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <Controller
                name={`${fieldName}.${index}.operator`}
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={operators}
                    isSearchable={false}
                    placeholder="Condition"
                    styles={selectStyles}
                    menuPortalTarget={menuPortalTarget ?? undefined}
                    menuPosition="fixed"
                  />
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <Controller
                name={`${fieldName}.${index}.value`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="Enter value"
                    className="form-input w-full border border-gray-300 rounded-md px-2 py-1.5 min-w-0 box-border"
                  />
                )}
              />
            </div>

            {conditions.length > 1 && (
              <button
                type="button"
                onClick={() => removeCondition(condition.id)}
                className="flex-shrink-0 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                aria-label="Remove condition"
              >
                <CircleX size={18} />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={addCondition}
            className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 cursor-pointer hover:bg-blue-600 transition-colors"
          >
            <Plus size={15} /> Add Condition
          </button>

          <button
            type="button"
            disabled={conditions.length === 0}
            onClick={() => setIsSidebarOpen(true)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              conditions.length === 0
                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                : "bg-green-600 hover:bg-green-700 text-white"
            } transition-colors`}
          >
            Test Expression
          </button>
        </div>

        {!hideJsonPreview && (
          <div className="mt-4 w-full border border-gray-300 rounded-md bg-gray-50 overflow-hidden">
            <Accordion
              iconClass="absolute -top-2 right-5 bg-white rounded-full text-gray-400"
              iconSize={16}
              title="Expand/Collapse"
              open={isAccordionOpen}
            >
              <div className="py-3 overflow-auto max-h-40 w-full">
                <pre className="text-sm px-3 w-full overflow-x-auto">
                  {nestedExpression
                    ? JSON.stringify(nestedExpression, null, 2)
                    : "Add conditions to build expression"}
                </pre>
              </div>
            </Accordion>
          </div>
        )}
      </div>

      {/* Right Sidebar for Test Output */}
      {isSidebarOpen && (
        <div className="fixed top-16 right-0 h-[calc(100%-4rem)] w-[500px] bg-white shadow-lg z-50 overflow-auto">
          <div className="flex justify-between items-center px-4 py-2 border-b">
            <h4 className="text-lg font-semibold">Test Results</h4>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="p-4 overflow-auto space-y-4">
            <div>
              <h5 className="text-sm font-semibold text-gray-700 mb-2">Built Expression</h5>
              <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                {nestedExpression
                  ? JSON.stringify(nestedExpression, null, 2)
                  : "No conditions added yet."}
              </pre>
            </div>
            <div>
              <h5 className="text-sm font-semibold text-gray-700 mb-2">Test Results</h5>
              <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                {/* Replace with actual test output when backend is connected */}
                Run test to see results here.
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpressionBuilder;
