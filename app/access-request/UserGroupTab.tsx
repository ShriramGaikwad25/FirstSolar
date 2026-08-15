"use client";
import React, { useEffect } from "react";
import { useForm, Control, FieldValues, useWatch } from "react-hook-form";
import MultiSelect from "@/components/MultiSelect";
import { loadGroups } from "@/components/MsAsyncData";

const UserGroupTab: React.FC = () => {
  const { control } = useForm<FieldValues>({
    defaultValues: {
      selectedUserGroups: [],
    },
  });

  const selectedGroups = useWatch({
    control,
    name: "selectedUserGroups",
  });

  useEffect(() => {
    try {
      const toStore = Array.isArray(selectedGroups)
        ? selectedGroups.map((g: any) => ({
            value: String(g?.value ?? "").trim(),
            label: String(g?.label ?? "").trim(),
          }))
        : [];
      if (typeof window !== "undefined") {
        window.localStorage.setItem("accessRequestSelectedGroups", JSON.stringify(toStore));
      }
    } catch {
      // ignore
    }
  }, [selectedGroups]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search and Select User Groups
        </label>
        <div className="max-w-md">
          <MultiSelect
            className="w-80"
            isMulti={true}
            control={control as unknown as Control<FieldValues>}
            name="selectedUserGroups"
            isAsync={true}
            loadOptions={(inputValue, callback) => {
              loadGroups(inputValue).then((options) => callback(options));
            }}
            placeholder="Search and select user groups..."
          />
        </div>
      </div>
    </div>
  );
};

export default UserGroupTab;

