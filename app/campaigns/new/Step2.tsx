import { useEffect } from "react";
import {
  useForm,
  Resolver,
  Control,
  FieldValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import MultiSelect from "@/components/MultiSelect";
import { customOption, loadIspmApps } from "@/components/MsAsyncData";
import FileDropzone from "@/components/FileDropzone";
import ToggleSwitch from "@/components/ToggleSwitch";
import {
  asterisk,
  userGroups,
  excludeUsers,
  downArrow,
  defaultExpression,
} from "@/utils/utils";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { Step2FormData, StepProps } from "@/types/stepTypes";
import { validationSchema } from "./step2Validation";

const Step2: React.FC<StepProps> = ({
  formData,
  setFormData,
  onValidationChange,
}) => {
  const {
    register,
    setValue,
    control,
    watch,
    resetField,
    formState: { errors, isValid },
  } = useForm<Step2FormData>({
    resolver: yupResolver(
      validationSchema
    ) as unknown as Resolver<Step2FormData>,
    mode: "onChange",
    defaultValues: {
      ...formData.step2,
      userType: formData.step2?.userType ?? "",
      expressionEntitlement: [defaultExpression],
      groupListIsChecked: false,
    },
  });

  useEffect(() => {
    onValidationChange(isValid);
  }, [isValid, onValidationChange]);

  useEffect(() => {
    const subscription = watch((values) =>
      setFormData({ ...formData, step2: values as Step2FormData })
    );
    return () => subscription.unsubscribe();
  }, [watch, setFormData, formData]);

  // **Reseting**
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
    }
  }, [selectData, setValue]);

  return (
    <div className="flex justify-center items-start py-10 px-4">
      <div className="bg-white shadow-lg ring-1 ring-gray-200 rounded-2xl p-8 w-full">
      <h2 className="text-lg font-bold">Campaign Scope</h2>
      <small className="text-gray-600 block mb-6">
        Name your new campaign and set its ownership and rules.
      </small>

      <div className="text-sm space-y-4 min-w-max lg:w-1/2">
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

                    {errors.userGroupList?.message &&
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

              {errors.excludeUsers?.message &&
                typeof errors.excludeUsers.message === "string" && (
                  <p className="text-red-500">{errors.excludeUsers.message}</p>
                )}
            </div>
          </div>
        </div>

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

            {watch("selectData") === "Specific Applications" && (
              <div className="grid grid-cols-[300px_1.5fr] gap-2 bg-[#F4F5FA]/60 border-1 border-gray-300 p-2 rounded-md">
                <div>
                  <MultiSelect
                    className=""
                    placeholder="Select Specific App(s)"
                    control={control as unknown as Control<FieldValues>}
                    isAsync
                    loadOptions={loadIspmApps}
                    components={{ Option: customOption }}
                    {...register("specificApps")}
                  />
                  {errors.specificApps?.message &&
                    typeof errors.specificApps.message === "string" && (
                      <p className="text-red-500">
                        {errors.specificApps.message}
                      </p>
                    )}
                </div>
                <div className="min-w-[300px] bg-white">
                  <ExpressionBuilder
                    //title="Build Expression for Apps"
                    control={control as unknown as Control<FieldValues>}
                    setValue={
                      setValue as unknown as UseFormSetValue<FieldValues>
                    }
                    watch={watch as unknown as UseFormWatch<FieldValues>}
                    fieldName="expressionApps"
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
                  {errors.expressionApps?.message &&
                    typeof errors.expressionApps.message === "string" && (
                      <p className="text-red-500">
                        {errors.expressionApps.message}
                      </p>
                    )}
                </div>
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
                {errors.expressionEntitlement?.message &&
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
  );
};

export default Step2;
