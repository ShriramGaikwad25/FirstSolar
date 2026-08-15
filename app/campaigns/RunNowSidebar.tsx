"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import MultiSelect from "@/components/MultiSelect";
import { customOption, loadUsers, loadIspmApps } from "@/components/MsAsyncData";
import { asterisk, downArrow, userGroups, excludeUsers, defaultExpression } from "@/utils/utils";
import ToggleSwitch from "@/components/ToggleSwitch";
import FileDropzone from "@/components/FileDropzone";
import { useRightSidebar } from "@/contexts/RightSidebarContext";

interface RunNowSidebarProps {
  template: {
    id: string;
    name: string;
    description?: string;
    userType?: string;
    selectData?: string;
    specificUserExpression?: any[];
    specificApps?: string[];
    expressionApps?: any[];
    expressionEntitlement?: any[];
    groupListIsChecked?: boolean;
    userGroupList?: string;
    excludeUsersIsChecked?: boolean;
    excludeUsers?: string;
  };
  onRunNow: (data: any) => void;
}

const RunNowSidebar: React.FC<RunNowSidebarProps> = ({
  template,
  onRunNow,
}) => {
  const { closeSidebar } = useRightSidebar();
  const {
    register,
    setValue,
    control,
    watch,
    resetField,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      certificationTemplate: template.name || "",
      description: template.description || "",
      userType: template.userType || "All users",
      selectData: template.selectData || "All Applications",
      specificUserExpression: template.specificUserExpression || [defaultExpression],
      specificApps: template.specificApps || [],
      expressionApps: template.expressionApps || [],
      expressionEntitlement: template.expressionEntitlement || [defaultExpression],
      groupListIsChecked: template.groupListIsChecked || false,
      userGroupList: template.userGroupList || "",
      excludeUsersIsChecked: template.excludeUsersIsChecked || false,
      excludeUsers: template.excludeUsers || "",
    },
  });

  useEffect(() => {
    if (template) {
      setValue("certificationTemplate", template.name || "");
      setValue("description", template.description || "");
      setValue("userType", template.userType || "All users");
      setValue("selectData", template.selectData || "All Applications");
    }
  }, [template, setValue]);

  const userType = watch("userType");
  const groupListIsChecked = watch("groupListIsChecked");
  const excludeUsersIsChecked = watch("excludeUsersIsChecked");
  const selectData = watch("selectData");

  useEffect(() => {
    if (userType === "All users") {
      setValue("userGroupList", "", { shouldValidate: false });
      setValue("specificUserExpression", [], { shouldValidate: false });
      setValue("groupListIsChecked", false, { shouldValidate: false });
    } else if (userType === "Custom User Group") {
      setValue("specificUserExpression", [], { shouldValidate: false });
      if (groupListIsChecked) {
        setValue("userGroupList", "", { shouldValidate: false });
      }
    } else if (userType === "Specific users") {
      setValue("userGroupList", "", { shouldValidate: false });
      setValue("groupListIsChecked", false, { shouldValidate: false });
    }
    if (!groupListIsChecked) {
      resetField("importNewUserGroup");
    }
    if (!excludeUsersIsChecked) {
      resetField("excludeUsers");
    }
  }, [userType, groupListIsChecked, excludeUsersIsChecked, resetField, setValue]);

  useEffect(() => {
    if (
      selectData === "All Applications" ||
      selectData === "Select Entitlement"
    ) {
      setValue("specificApps", [], { shouldValidate: false });
      setValue("expressionApps", [], { shouldValidate: false });
    }
    if (selectData === "All Applications") {
      setValue("expressionEntitlement", [], { shouldValidate: false });
    }
    if (selectData === "Specific Applications") {
      setValue("expressionEntitlement", [], { shouldValidate: false });
    }
    if (selectData === "Select Entitlement") {
      setValue("specificApps", [], { shouldValidate: false });
    }
  }, [selectData, setValue]);

  const onSubmit = (data: any) => {
    onRunNow(data);
    closeSidebar();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Run Template Now</h2>
        <button
          onClick={closeSidebar}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Template Name */}
          <div className="grid grid-cols-[150px_1fr] gap-4 items-start">
            <label className={`pt-2 ${asterisk}`}>Template Name</label>
            <div>
              <input
                type="text"
                className="form-input w-full"
                {...register("certificationTemplate", { required: "Template Name is required" })}
              />
              {errors.certificationTemplate?.message &&
                typeof errors.certificationTemplate.message === "string" && (
                  <p className="text-red-500 text-sm mt-1">{errors.certificationTemplate.message}</p>
                )}
            </div>
          </div>

          {/* Description */}
          <div className="grid grid-cols-[150px_1fr] gap-4 items-start">
            <label className={`pt-2 ${asterisk}`}>Description</label>
            <div>
              <textarea
                className="form-input w-full"
                rows={3}
                {...register("description", { required: "Description is required" })}
              />
              {errors.description?.message &&
                typeof errors.description.message === "string" && (
                  <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                )}
            </div>
          </div>

          {/* Campaign Scope Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Campaign Scope</h3>
            <div className="space-y-6">
              {/* Select Users */}
              <div className="grid grid-cols-[150px_1fr] gap-4 items-start">
                <label className={`pt-2 ${asterisk}`}>Select Users</label>
                <div>
                  <select
                    className="form-input w-full max-w-md"
                    {...register("userType", { required: "User Type is required" })}
                    onChange={(e) => setValue("userType", e.target.value, { shouldValidate: true })}
                  >
                    <option value="All users">All users</option>
                    <option value="Specific users">Specific users</option>
                    <option value="Custom User Group">Custom User Group</option>
                  </select>
                  {errors.userType?.message &&
                    typeof errors.userType.message === "string" && (
                      <p className="text-red-500 text-sm mt-1">{errors.userType.message}</p>
                    )}

                  {watch("userType") === "Specific users" && (
                    <div className="mt-4">
                      <input
                        type="text"
                        className="form-input w-full max-w-md"
                        placeholder="Enter user expression"
                        {...register("specificUserExpression")}
                      />
                    </div>
                  )}

                  {watch("userType") === "Custom User Group" && (
                    <>
                      <div className="flex items-center gap-1 mb-2">
                        <span
                          className={`flex items-center ${
                            !watch("groupListIsChecked")
                              ? `${asterisk} !pr-0 text-black`
                              : "text-black/50"
                          }`}
                        >
                          Select from List
                        </span>
                        <ToggleSwitch
                          checked={watch("groupListIsChecked")}
                          onChange={(checked) => {
                            setValue("groupListIsChecked", checked, {
                              shouldValidate: true,
                            });
                          }}
                          className="scale-80"
                        />
                        <span
                          className={`flex items-center ${
                            watch("groupListIsChecked")
                              ? `${asterisk} !pr-0 text-black`
                              : "text-black/50"
                          }`}
                        >
                          Import New User Group
                        </span>
                      </div>

                      {watch("groupListIsChecked") && (
                        <div className="w-[450px]">
                          <FileDropzone
                            name="importNewUserGroup"
                            control={control as unknown as Control<FieldValues>}
                          />
                        </div>
                      )}
                      {!watch("groupListIsChecked") && (
                        <>
                          <MultiSelect
                            className="max-w-[420px]"
                            isMulti={true}
                            control={control as unknown as Control<FieldValues>}
                            options={userGroups}
                            {...register("userGroupList")}
                          />
                        </>
                      )}
                    </>
                  )}
                  <div className="mt-2">
                    <div className="flex items-center gap-1 py-2">
                      <input type="checkbox" {...register("excludeUsersIsChecked")} />{" "}
                      <span
                        className={` ${watch("excludeUsersIsChecked") && asterisk}`}
                      >
                        exclude users from the certification campaign
                      </span>
                    </div>

                    <MultiSelect
                      isDisabled={!watch("excludeUsersIsChecked")}
                      className="max-w-[420px]"
                      isMulti={true}
                      control={control as unknown as Control<FieldValues>}
                      options={excludeUsers}
                      {...register("excludeUsers")}
                    />
                  </div>
                </div>
              </div>

              {/* Select Data */}
              <div className="grid grid-cols-[150px_1fr] gap-4 items-start">
                <label className={`pt-2 ${asterisk}`}>Select Data</label>
                <div>
                  <select
                    className="form-input w-full max-w-md"
                    {...register("selectData", { required: "Select Data is required" })}
                    onChange={(e) => setValue("selectData", e.target.value, { shouldValidate: true })}
                  >
                    <option value="All Applications">All Applications</option>
                    <option value="Specific Applications">Specific Applications</option>
                    <option value="Select Entitlement">Select Entitlement</option>
                  </select>
                  {errors.selectData?.message &&
                    typeof errors.selectData.message === "string" && (
                      <p className="text-red-500 text-sm mt-1">{errors.selectData.message}</p>
                    )}

                  {watch("selectData") === "Specific Applications" && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <MultiSelect
                          className="max-w-md"
                          placeholder="Select Specific App(s)"
                          control={control as unknown as Control<FieldValues>}
                          isAsync
                          loadOptions={loadIspmApps}
                          components={{ Option: customOption }}
                          {...register("specificApps")}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          className="form-input w-full max-w-md"
                          placeholder="Enter application expression"
                          {...register("expressionApps")}
                        />
                      </div>
                    </div>
                  )}
                  {watch("selectData") === "Select Entitlement" && (
                    <div className="mt-4">
                      <input
                        type="text"
                        className="form-input w-full max-w-md"
                        placeholder="Enter entitlement expression"
                        {...register("expressionEntitlement")}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Run Now Button */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Run Now
          </button>
        </div>
      </form>
    </div>
  );
};

export default RunNowSidebar;
