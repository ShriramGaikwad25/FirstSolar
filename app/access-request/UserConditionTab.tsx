"use client";
import React from "react";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import ExpressionBuilder from "@/components/ExpressionBuilder";

const UserConditionTab: React.FC = () => {
  const { control, setValue, watch } = useForm<FieldValues>({
    defaultValues: {
      userConditions: [],
    },
  });

  // User-specific attributes for the expression builder
  const userAttributes = [
    { label: "User Role", value: "user_role" },
    { label: "Department", value: "department" },
    { label: "Location", value: "location" },
    { label: "Access Level", value: "access_level" },
    { label: "Status", value: "status" },
    { label: "Job Title", value: "job_title" },
    { label: "Email", value: "email" },
    { label: "Manager", value: "manager" },
    { label: "Employee Type", value: "employee_type" },
  ];

  return (
    <div className="p-6">
      <ExpressionBuilder
        control={control as unknown as Control<FieldValues>}
        setValue={setValue as unknown as UseFormSetValue<FieldValues>}
        watch={watch as unknown as UseFormWatch<FieldValues>}
        fieldName="userConditions"
        attributesOptions={userAttributes}
      />
    </div>
  );
};

export default UserConditionTab;

