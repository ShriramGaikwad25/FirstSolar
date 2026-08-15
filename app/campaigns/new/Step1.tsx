import { useEffect, useState, useRef, useMemo } from "react";
import { Control, FieldValues, Resolver, useForm, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import MultiSelect from "@/components/MultiSelect";
import { loadUsers, loadGroups, customOption, loadIspmApps } from "@/components/MsAsyncData";
import FileDropzone from "@/components/FileDropzone";
import ToggleSwitch from "@/components/ToggleSwitch";
import { asterisk, downArrow, userGroups, excludeUsers, defaultExpression } from "@/utils/utils";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { StepProps, FormData, AccountTypeScope } from "@/types/stepTypes";
import { validationSchema } from "./step1CombinedValidation";
// Combined form data type
type CombinedStep1FormData = {
  // Step1 fields
  ownerUser?: any[];
  ownerGroup?: any[];
  certificationTemplate: string;
  description: string;
  campaignType: string;
  instanceDefaultname: string;
  ownerType: string;
  // Step2 fields
  userType: string;
  specificUserExpression: { attribute: any; operator: any; value: string }[];
  specificApps: string[] | null;
  expressionApps: { attribute: any; operator: any; value: string }[];
  expressionEntitlement: { attribute: any; operator: any; value: string }[];
  groupListIsChecked: boolean;
  userGroupList: string | null;
  importNewUserGroup: File | null;
  excludeUsersIsChecked: boolean;
  excludeUsers: string | null;
  selectData: string;
  accountType: AccountTypeScope;
};

const Step1: React.FC<StepProps> = ({
  formData,
  setFormData,
  onValidationChange,
  isEditMode = false,
}) => {
  // Combine step1 and step2 data for the form
  const combinedData: CombinedStep1FormData = {
    ...formData.step1,
    ...formData.step2,
    userType: formData.step2?.userType ?? "All users",
    selectData: formData.step2?.selectData ?? "All Applications",
    accountType: formData.step2?.accountType ?? "regular",
    expressionEntitlement: formData.step2?.expressionEntitlement ?? [defaultExpression],
    groupListIsChecked: formData.step2?.groupListIsChecked ?? false,
    specificUserExpression: formData.step2?.specificUserExpression ?? [],
    specificApps: formData.step2?.specificApps ?? [],
    expressionApps: formData.step2?.expressionApps ?? [],
    ownerType: formData.step1?.ownerType ?? "User",
    ownerUser: formData.step1?.ownerUser ?? [],
    ownerGroup: formData.step1?.ownerGroup ?? [],
    certificationTemplate: formData.step1?.certificationTemplate ?? "",
    description: formData.step1?.description ?? "",
    campaignType: formData.step1?.campaignType ?? "",
    instanceDefaultname: formData.step1?.instanceDefaultname ?? "",
  };

  const {
    register,
    setValue,
    control,
    watch,
    reset,
    resetField,
    trigger,
    getValues,
    formState: { errors, isValid, touchedFields },
  } = useForm<CombinedStep1FormData>({
    resolver: yupResolver(validationSchema) as unknown as Resolver<CombinedStep1FormData>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: combinedData,
  });

  // Watch for form value changes and trigger validation
  const watchedValues = watch();

  useEffect(() => {
    // Debug: Log validation state
    console.log("Step1 Validation State:", { 
      isValid, 
      errors: Object.keys(errors).length > 0 ? errors : "No errors",
      hasCertificationTemplate: !!watchedValues.certificationTemplate,
      hasDescription: !!watchedValues.description,
      ownerType: watchedValues.ownerType,
      hasOwnerUser: Array.isArray(watchedValues.ownerUser) && watchedValues.ownerUser.length > 0,
      hasOwnerGroup: Array.isArray(watchedValues.ownerGroup) && watchedValues.ownerGroup.length > 0,
      userType: watchedValues.userType,
      selectData: watchedValues.selectData,
    });
    onValidationChange(isValid);
  }, [isValid, onValidationChange, errors, watchedValues]);

  // Trigger validation on mount and when key form values change
  useEffect(() => {
    const validateForm = async () => {
      const result = await trigger();
      console.log("Step1 Validation Trigger Result:", result, "Errors:", Object.keys(errors));
    };
    // Delay slightly to ensure form is fully initialized
    const timeoutId = setTimeout(() => {
      validateForm();
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [trigger, watchedValues.certificationTemplate, watchedValues.description, watchedValues.ownerType, watchedValues.userType, watchedValues.selectData]);

  const prevCombinedDataRef = useRef<string | undefined>();

  // Reset form when formData changes externally (e.g., when template is applied)
  useEffect(() => {
    const newCombinedData: CombinedStep1FormData = {
      ...formData.step1,
      ...formData.step2,
      userType: formData.step2?.userType ?? "All users",
      selectData: formData.step2?.selectData ?? "All Applications",
      accountType: formData.step2?.accountType ?? "regular",
      expressionEntitlement: formData.step2?.expressionEntitlement ?? [defaultExpression],
      groupListIsChecked: formData.step2?.groupListIsChecked ?? false,
      specificUserExpression: formData.step2?.specificUserExpression ?? [],
      specificApps: formData.step2?.specificApps ?? [],
      expressionApps: formData.step2?.expressionApps ?? [],
      ownerType: formData.step1?.ownerType ?? "User",
      ownerUser: formData.step1?.ownerUser ?? [],
      ownerGroup: formData.step1?.ownerGroup ?? [],
      certificationTemplate: formData.step1?.certificationTemplate ?? "",
      description: formData.step1?.description ?? "",
      campaignType: formData.step1?.campaignType ?? "",
      instanceDefaultname: formData.step1?.instanceDefaultname ?? "",
    };

    const currentSerialized = JSON.stringify(newCombinedData);
    
    // If this is the first time we have data, always reset
    if (prevCombinedDataRef.current === undefined) {
      console.log("Step1: First time loading data, resetting with values:", newCombinedData);
      reset(newCombinedData, { keepDefaultValues: false });
      prevCombinedDataRef.current = currentSerialized;
      return;
    }

    // If we previously had empty data and now have meaningful data, reset
    if (prevCombinedDataRef.current && prevCombinedDataRef.current === "{}" && currentSerialized !== "{}") {
      console.log("Step1: Data loaded after empty initial state, resetting with values:", newCombinedData);
      reset(newCombinedData, { keepDefaultValues: false });
      prevCombinedDataRef.current = currentSerialized;
      return;
    }

    // For subsequent updates, only reset if formData is different from current form values
    if (prevCombinedDataRef.current !== currentSerialized) {
      const currentFormValues = getValues();
      const currentFormSerialized = JSON.stringify(currentFormValues);
      
      // Only reset if formData is different from current form values (external change)
      if (currentFormSerialized !== currentSerialized) {
        console.log("Step1: Resetting form with external values:", newCombinedData);
        reset(newCombinedData, { keepDefaultValues: false });
        prevCombinedDataRef.current = currentSerialized;
      } else {
        // Update the ref even if we don't reset, to track the change
        prevCombinedDataRef.current = currentSerialized;
      }
    } else if (prevCombinedDataRef.current === undefined) {
      // If prevCombinedDataRef is still undefined and we have data, set it
      prevCombinedDataRef.current = currentSerialized;
    }
  }, [formData.step1, formData.step2, reset, getValues]);

  useEffect(() => {
    const subscription = watch((values) => {
      // Split the combined data back into step1 and step2
      const step1Data = {
        ownerUser: values.ownerUser,
        ownerGroup: values.ownerGroup,
        certificationTemplate: values.certificationTemplate,
        description: values.description,
        campaignType: values.campaignType,
        instanceDefaultname: values.instanceDefaultname,
        ownerType: values.ownerType,
      };
      const step2Data = {
        userType: values.userType,
        specificUserExpression: values.specificUserExpression,
        specificApps: values.specificApps,
        expressionApps: values.expressionApps,
        expressionEntitlement: values.expressionEntitlement,
        groupListIsChecked: values.groupListIsChecked,
        userGroupList: values.userGroupList,
        importNewUserGroup: values.importNewUserGroup,
        excludeUsersIsChecked: values.excludeUsersIsChecked,
        excludeUsers: values.excludeUsers,
        selectData: values.selectData,
        accountType: values.accountType,
      };
      setFormData((prev) => ({ ...prev, step1: step1Data, step2: step2Data }));
    });
    return () => subscription.unsubscribe();
  }, [watch, setFormData]);

  const ownerType = watch("ownerType");
  useEffect(() => {
    if (ownerType === "User") {
      setValue("ownerGroup", [], { shouldValidate: true });
    } else if (ownerType === "Group") {
      setValue("ownerUser", [], { shouldValidate: true });
    }
  }, [ownerType, setValue]);

  // Auto-populate instanceDefaultname when certificationTemplate changes (only if not in edit mode)
  const certificationTemplate = watch("certificationTemplate");
  const currentInstanceDefaultname = watch("instanceDefaultname");
  useEffect(() => {
    if (certificationTemplate && !isEditMode) {
      const defaultInstanceName = `${certificationTemplate} - {{QTR}}_{{MONTH}}_{{DATE}}_{{YEAR}}`;
      setValue("instanceDefaultname", defaultInstanceName, { shouldValidate: false });
    }
  }, [certificationTemplate, setValue, isEditMode]);

  // Step2 field resets
  const userType = watch("userType");
  const groupListIsChecked = watch("groupListIsChecked");
  const excludeUsersIsChecked = watch("excludeUsersIsChecked");

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
  }, [
    userType,
    groupListIsChecked,
    excludeUsersIsChecked,
    resetField,
    setValue,
  ]);

  const selectData = watch("selectData");
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
      setValue("accountType", "regular", { shouldValidate: false });
    }
  }, [selectData, setValue]);

  const campaignType = watch("campaignType");
  const isAppOwnerTemplate = campaignType === "AppOwnerReview";
  const accountType = watch("accountType");
  const isExpressionBuilderDisabled = (accountType === "service" || accountType === "both") && watch("selectData") === "Specific Applications";

  // Check if this is an Entitlement Owner template
  const isEntitlementOwnerTemplate = useMemo(() => {
    const campaignType = watch("campaignType");
    const reviewers = formData.step3?.stages || [];
    
    // Check if campaign type is EntitlementOwnerReview
    if (campaignType === "EntitlementOwnerReview") {
      return true;
    }
    
    // Check if any reviewer is Entitlement Owner
    const hasEntitlementOwner = reviewers.some((stage: any) => {
      const reviewer = stage?.reviewer || "";
      return reviewer === "entitlement-owner" || reviewer === "EntitlementOwner" || reviewer === "Entitlement Owner";
    });
    
    return hasEntitlementOwner;
  }, [watch("campaignType"), formData.step3?.stages]);

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-xl font-bold text-blue-950 text-center mb-8">
        {isEntitlementOwnerTemplate
          ? "Entitlement Owner Access Review"
          : "Create an access review campaign"}
      </h2>

        <div className="text-sm space-y-6 w-full max-w-6xl">
          {/* Step1 Fields */}
          <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
            <label htmlFor="certificationTemplate" className={`pl-2 ${asterisk}`}>Template Name</label>
            <div className="max-w-md">
              <input
                id="certificationTemplate"
                type="text"
                className="form-input"
                disabled={isEditMode}
                aria-invalid={!!errors.certificationTemplate}
                aria-describedby={errors.certificationTemplate ? "certificationTemplate-error" : undefined}
                {...register("certificationTemplate")}
              />
              {touchedFields.certificationTemplate && errors.certificationTemplate?.message &&
                typeof errors.certificationTemplate.message === "string" && (
                  <p id="certificationTemplate-error" className="text-red-500" role="alert" aria-live="polite">
                    {errors.certificationTemplate.message}
                  </p>
                )}
            </div>
          </div>

          <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
            <label htmlFor="description" className={`pl-2 ${asterisk}`}>Description</label>
            <div className="max-w-md">
              <textarea
                id="description"
                className="form-input"
                rows={3}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "description-error" : undefined}
                {...register("description")}
              ></textarea>
              {touchedFields.description && errors.description?.message &&
                typeof errors.description.message === "string" && (
                  <p id="description-error" className="text-red-500" role="alert" aria-live="polite">
                    {errors.description.message}
                  </p>
                )}
            </div>
          </div>

          <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
            <label htmlFor="instanceDefaultname" className="pl-2">Default instance name</label>
            <div className="max-w-md">
              <input
                id="instanceDefaultname"
                type="text"
                className="form-input"
                {...register("instanceDefaultname")}
              />
            </div>
          </div>

          {/* Hide Campaign Type for Entitlement Owner templates in edit mode */}
          {!(isEditMode && isEntitlementOwnerTemplate) && (
            <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
              <label htmlFor="campaignType" className={`pl-2 ${asterisk}`}>Campaign Type</label>
              <div className="max-w-md">
                <input
                  id="campaignType"
                  type="text"
                  className="form-input"
                  disabled={isEditMode}
                  aria-invalid={!!errors.campaignType}
                  aria-describedby={errors.campaignType ? "campaignType-error" : undefined}
                  {...register("campaignType")}
                />
                {touchedFields.campaignType && errors.campaignType?.message &&
                  typeof errors.campaignType.message === "string" && (
                    <p id="campaignType-error" className="text-red-500" role="alert" aria-live="polite">
                      {errors.campaignType.message}
                    </p>
                  )}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
            <label className={`pl-2 ${asterisk}`}>Owners</label>
            <div>
              {["User", "Group"].map((option, index, array) => (
                <button
                  key={option}
                  type="button"
                  className={`px-4 relative py-2 mb-3 min-w-16 rounded-md border border-gray-300 ${
                    watch("ownerType") === option && downArrow
                  } ${
                    watch("ownerType") === option ? "bg-[#15274E] text-white" : ""
                  } ${index === 0 && "rounded-r-none"} ${
                    array.length > 2 &&
                    index === 1 &&
                    "rounded-none border-r-0 border-l-0"
                  } ${index === array.length - 1 && "rounded-l-none"}`}
                  onClick={() =>
                    setValue("ownerType", option, { shouldValidate: true })
                  }
                >
                  {option}
                </button>
              ))}

              {watch("ownerType") === "User" && (
                <>
                  <MultiSelect
                    className="max-w-[420px]"
                    control={control as unknown as Control<FieldValues>}
                    isAsync
                    loadOptions={loadUsers}
                    components={{ Option: customOption }}
                    {...register("ownerUser")}
                  />
                  {touchedFields.ownerUser && errors.ownerUser?.message &&
                    typeof errors.ownerUser.message === "string" && (
                      <p className="text-red-500">{errors.ownerUser.message}</p>
                    )}
                </>
              )}

              {watch("ownerType") === "Group" && (
                <>
                  <MultiSelect
                    className="max-w-[420px]"
                    control={control as unknown as Control<FieldValues>}
                    isAsync
                    loadOptions={loadGroups}
                    components={{ Option: customOption }}
                    {...register("ownerGroup")}
                  />
                  {touchedFields.ownerGroup && errors.ownerGroup?.message &&
                    typeof errors.ownerGroup.message === "string" && (
                      <p className="text-red-500">{errors.ownerGroup.message}</p>
                    )}
                </>
              )}
            </div>
          </div>

          {/* Step2 Fields - Campaign Scope Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Campaign Scope</h3>
            <div className="space-y-6">
              {/* Hide Select Users section for Entitlement Owner templates in edit mode */}
              {!(isEditMode && isEntitlementOwnerTemplate) && (
                <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
                  <label className={`pl-2 ${asterisk}`}>Select Users</label>
              <div>
                {["All users", "Specific users", "Custom User Group"].map(
                  (option, index, array) => (
                    <button
                      key={option}
                      type="button"
                      className={`px-4 relative py-2 mb-3 min-w-16 rounded-md border border-gray-300 ${
                        watch("userType") === option && index > 0 && downArrow
                      } ${
                        watch("userType") === option
                          ? "bg-[#15274E] text-white"
                          : ""
                      } ${index === 0 && "rounded-r-none"} ${
                        array.length > 2 &&
                        index === 1 &&
                        "rounded-none border-r-0  border-l-0 "
                      } ${index === array.length - 1 && "rounded-l-none"}`}
                      onClick={() =>
                        setValue("userType", option, { shouldValidate: true })
                      }
                    >
                      {option}
                    </button>
                  )
                )}

                {watch("userType") === "Specific users" && (
                  <ExpressionBuilder
                    title="Build Expression"
                    control={control as unknown as Control<FieldValues>}
                    setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                    watch={watch as unknown as UseFormWatch<FieldValues>}
                    fieldName="specificUserExpression"
                    fullWidth
                  />
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

                        {touchedFields.userGroupList && errors.userGroupList?.message &&
                          typeof errors.userGroupList.message === "string" && (
                            <p className="text-red-500">
                              {errors.userGroupList.message}
                            </p>
                          )}
                      </>
                    )}
                  </>
                )}
                <div className="">
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

                  {touchedFields.excludeUsers && errors.excludeUsers?.message &&
                    typeof errors.excludeUsers.message === "string" && (
                      <p className="text-red-500">{errors.excludeUsers.message}</p>
                    )}
                </div>
              </div>
              </div>
              )}

          <div className={`grid grid-cols-[280px_1.5fr] gap-2`}>
            <label className={`pl-2 ${asterisk}`}>Select Data</label>
            <div>
              {[
                "All Applications",
                "Specific Applications",
                "Select Entitlement",
              ].map((option, index, array) => (
                <button
                  key={option}
                  type="button"
                  className={`px-4 relative py-2 mb-3 min-w-16 rounded-md border border-gray-300  ${
                    watch("selectData") === option && index > 0 && downArrow
                  } ${
                    watch("selectData") === option
                      ? "bg-[#15274E] text-white"
                      : ""
                  } ${index === 0 && "rounded-r-none"} ${
                    array.length > 2 &&
                    index === 1 &&
                    "rounded-none border-r-0  border-l-0 "
                  } ${index === array.length - 1 && "rounded-l-none"}`}
                  onClick={() =>
                    setValue("selectData", option, { shouldValidate: true })
                  }
                >
                  {option}
                </button>
              ))}

              {/* App Owner template only: Account type (compact) */}
              {isAppOwnerTemplate && (
                <div className="mt-3 mb-4 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Account type:</span>
                  {watch("selectData") === "Select Entitlement" ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 bg-gray-50 text-gray-500 text-xs font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" aria-hidden />
                      <span>Regular accounts</span>
                    </span>
                  ) : (
                    <div className="flex gap-0 rounded border border-gray-300 overflow-hidden">
                      {[
                        { value: "regular" as const, label: "Regular account" },
                        { value: "service" as const, label: "Service account" },
                        { value: "both" as const, label: "Both" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setValue("accountType", opt.value, { shouldValidate: true })}
                          className={`px-3 py-1.5 text-xs font-medium border-r border-gray-300 last:border-r-0 transition-colors ${
                            accountType === opt.value ? "bg-teal-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {watch("selectData") === "Specific Applications" && (
                <div className="space-y-4 bg-[#F4F5FA]/60 border-1 border-gray-300 p-4 rounded-md">
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
                    {touchedFields.specificApps && errors.specificApps?.message &&
                      typeof errors.specificApps.message === "string" && (
                        <p className="text-red-500">
                          {errors.specificApps.message}
                        </p>
                      )}
                  </div>
                  {!isExpressionBuilderDisabled && (
                    <div className="w-full bg-white">
                      <ExpressionBuilder
                        control={control as unknown as Control<FieldValues>}
                        setValue={
                          setValue as unknown as UseFormSetValue<FieldValues>
                        }
                        watch={watch as unknown as UseFormWatch<FieldValues>}
                        fieldName="expressionApps"
                        fullWidth
                        attributesOptions={[
                          { label: "Risk", value: "risk" },
                          { label: "Pre-Requisite", value: "pre_requisite" },
                          { label: "Shared Pwd", value: "shared_pwd" },
                          { label: "Regulatory Scope", value: "regulatory_scope" },
                          { label: "Access Scope", value: "access_scope" },
                          { label: "Review Schedule", value: "review_schedule" },
                          { label: "Business Unit", value: "business_unit" },
                          { label: "Data Classification", value: "data_classification" },
                          { label: "Privileged", value: "privileged" },
                          { label: "Non Persistent Access", value: "non_persistent_access" },
                          { label: "License Type", value: "license_type" },
                          { label: "Tags", value: "tags" },
                        ]}
                      />
                      {touchedFields.expressionApps && errors.expressionApps?.message &&
                        typeof errors.expressionApps.message === "string" && (
                          <p className="text-red-500">
                            {errors.expressionApps.message}
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}
              {watch("selectData") === "Select Entitlement" && (
                <>
                  <ExpressionBuilder
                    title="Build Expression for Entitlement"
                    control={control as unknown as Control<FieldValues>}
                    setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                    watch={watch as unknown as UseFormWatch<FieldValues>}
                    fieldName="expressionEntitlement"
                    fullWidth
                    attributesOptions={[
                      { label: "Risk", value: "risk" },
                      { label: "Pre-Requisite", value: "pre_requisite" },
                      { label: "Shared Pwd", value: "shared_pwd" },
                      { label: "Regulatory Scope", value: "regulatory_scope" },
                      { label: "Access Scope", value: "access_scope" },
                      { label: "Review Schedule", value: "review_schedule" },
                      { label: "Business Unit", value: "business_unit" },
                      { label: "Data Classification", value: "data_classification" },
                      { label: "Privileged", value: "privileged" },
                      { label: "Non Persistent Access", value: "non_persistent_access" },
                      { label: "License Type", value: "license_type" },
                      { label: "Tags", value: "tags" },
                    ]}
                  />
                  {touchedFields.expressionEntitlement && errors.expressionEntitlement?.message &&
                    typeof errors.expressionEntitlement.message === "string" && (
                      <p className="text-red-500">
                        {errors.expressionEntitlement.message}
                      </p>
                    )}
                </>
              )}
            </div>
          </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Step1;
