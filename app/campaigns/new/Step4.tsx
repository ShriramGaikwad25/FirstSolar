import { BookTemplate, InfoIcon, MailPlus, Pencil, Save } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Control,
  FieldValues,
  Resolver,
  useForm,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import ToggleSwitch from "@/components/ToggleSwitch";
import MultiSelect from "@/components/MultiSelect";
import {
  asterisk,
  beforeExpiryReminders,
  enforceComments,
  startOfCampaign,
  everyDayReminders,
  beforeReminders,
  optionsData,
  selectAttribute,
  markUndecidedAccessOptions,
} from "@/utils/utils";
import { customOption, loadUsers } from "@/components/MsAsyncData";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { Step4FormData, StepProps } from "@/types/stepTypes";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import CustomMultiSelectBeforeExpiry from "@/components/CustomMultiSelectBeforeExpiry";
import CustomMultiSelectBeforeEscalation from "@/components/CustomMultiSelectBeforeEscalation";
import CustomMultiSelectOnDay from "@/components/CustomMultiSelectOnDay";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import EmailTemplateEditor from "@/components/EmailTemplateEditor";


const validationSchema = yup.object().shape({
  // Notifications
  socReminders: yup.array(),
  eocReminders: yup.array(),
  // New notification fields
  startOfCampaign: yup.boolean(),
  startOfCampaignReminders: yup.array().when("startOfCampaign", {
    is: true,
    then: (schema) => schema.min(1, "At least one reminder is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  remindersDuringCampaign: yup.boolean(),
  remindersDuringCampaignReminders: yup.array().when("remindersDuringCampaign", {
    is: true,
    then: (schema) => schema.min(1, "At least one reminder is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  atEscalation: yup.boolean(),
  atEscalationReminders: yup.array().when("atEscalation", {
    is: true,
    then: (schema) => schema.min(1, "At least one reminder is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  campaignClosure: yup.boolean(),
  msTeamsNotification: yup.boolean(),
  msTeamsChannelName: yup.string().when("msTeamsNotification", {
    is: true,
    then: (schema) => schema
      .required("Channel name is required")
      .max(50, "Channel name must be no more than 50 characters"),
    otherwise: (schema) => schema.notRequired(),
  }),
  msTeamsDescription: yup.string().when("msTeamsNotification", {
    is: true,
    then: (schema) => schema.notRequired(),
    otherwise: (schema) => schema.notRequired(),
  }),
  msTeamsTeamId: yup.string().when("msTeamsNotification", {
    is: true,
    then: (schema) => schema.required("Team ID/Microsoft 365 Group ID is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  allowDownloadUploadCropNetwork: yup.boolean(),

  // Campaign Management
  markUndecidedRevoke: yup.boolean(),
  disableBulkAction: yup.boolean(),
  enforceComments: yup.string(),
  genericExpression: yup.array().when("enforceComments", {
    is: "Custom Fields",
    then: (schema) =>
      schema
        .of(
          yup.object().shape({
            attribute: yup
              .object()
              .nullable()
              .required("Attribute is required"),
            operator: yup.object().nullable().required("Operator is required"),
            value: yup.string().required("Value is required"),
          })
        )
        .min(1, "At least one condition is required")
        .default([]), // 👈 Ensures validation even if untouched
    otherwise: (schema) => schema.notRequired(),
  }),
  // Advanced Setting
  allowEscalation: yup.string(),
  certifierUnavailableUsers: yup.array().nullable().notRequired(),
  ticketConditionalApproval: yup.boolean(),
  authenticationSignOff: yup.boolean(),
  // generatePin: yup.string().when("authenticationSignOff", {
  //   is: true,
  //   then: (schema) => schema.required("User Pin is required"),
  //   otherwise: (schema) => schema.notRequired(),
  // }),
  // verifyUserAttribute: yup.string().when("authenticationSignOff", {
  //   is: true,
  //   then: (schema) => schema.required("User Attribute is required"),
  //   otherwise: (schema) => schema.notRequired(),
  // }),
  applicationScope: yup.boolean(),
  preDelegate: yup.boolean(),
});

const Step4: React.FC<StepProps> = ({
  formData,
  setFormData,
  onValidationChange,
}) => {
  const {
    register,
    setValue,
    watch,
    control,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<Step4FormData>({
    resolver: yupResolver(
      validationSchema
    ) as unknown as Resolver<Step4FormData>,
    shouldUnregister: !formData.step4,
    mode: "onChange",
    defaultValues: formData.step4 || {},
  });
  const enforComments = watch("enforceComments");
  const showGenericExpression = enforComments === "Custom Fields";
  const { openSidebar, closeSidebar } = useRightSidebar();
  const [msTeamsSaveStatus, setMsTeamsSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Check if this is an Entitlement Owner template (only in edit mode)
  // We determine edit mode by checking if formData has existing campaign type or reviewers
  const isEntitlementOwnerTemplate = useMemo(() => {
    const campaignType = formData.step1?.campaignType || "";
    const reviewers = formData.step3?.stages || [];
    
    // Only apply Entitlement Owner restrictions if we have existing data (edit mode)
    const isEditMode = !!(campaignType || (reviewers && reviewers.length > 0 && reviewers[0]?.reviewer));
    
    if (!isEditMode) {
      return false;
    }
    
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
  }, [formData.step1?.campaignType, formData.step3?.stages]);

  // For Entitlement Owner templates, use different enforceComments options
  const enforceCommentsOptions = useMemo(() => {
    if (isEntitlementOwnerTemplate) {
      return [
        { value: "Approve", label: "Approve" },
        { value: "Reassign", label: "Reassign" },
        { value: "Lock", label: "Lock" },
        { value: "Decommission", label: "Decommission" },
        { value: "Custom Fields", label: "Custom Fields" },
      ];
    }
    return enforceComments;
  }, [isEntitlementOwnerTemplate]);

  // Options for dropdowns
  // During campaign options (includes Start Of Campaign)
  const duringCampaignOptions = [...startOfCampaign, ...everyDayReminders];
  // During campaign options without Start Of Campaign
  const duringCampaignWithoutStartOptions = [...everyDayReminders];
  // During campaign before escalation options
  const beforeEscalationOptions = [...beforeReminders];

  // Helper function to open email template editor in right sidebar
  const handleOpenTemplateEditor = (templateType: "start" | "reminders" | "escalation" | "closure") => {
    const titles = {
      start: "Email Template - Start of Campaign",
      reminders: "Email Template - Reminders during Campaign",
      escalation: "Email Template - At Escalation",
      closure: "Email Template - Campaign Closure",
    };

    const fieldNames = {
      start: "startOfCampaignTemplateName",
      reminders: "remindersDuringCampaignTemplateName",
      escalation: "atEscalationTemplateName",
      closure: "campaignClosureTemplateName",
    };

    const templateDataFields = {
      start: "startOfCampaignTemplateData",
      reminders: "remindersDuringCampaignTemplateData",
      escalation: "atEscalationTemplateData",
      closure: "campaignClosureTemplateData",
    };

    // Get previously saved template data if it exists
    const savedTemplateData = watch(templateDataFields[templateType] as any) || null;

    openSidebar(
      <EmailTemplateEditor
        templateType={templateType}
        initialData={savedTemplateData}
        onSave={(data) => {
          console.log("Template saved:", templateType, data);
          if (data.templateName) {
            setValue(fieldNames[templateType] as any, data.templateName);
          }
          // Store the full template data
          setValue(templateDataFields[templateType] as any, {
            selectedTemplateId: data.selectedTemplateId,
            to: data.to,
            cc: data.cc,
            bcc: data.bcc,
            templateName: data.templateName,
          });
          closeSidebar();
        }}
      />,
      {
        widthPx: 600,
        title: titles[templateType],
      }
    );
  };

  const prevStep4Ref = useRef<string | undefined>();
  const isInitialMount = useRef(true);

  // Helper to check if formData has meaningful data (not just empty object)
  const hasMeaningfulData = (data: any) => {
    if (!data || typeof data !== 'object') return false;
    const keys = Object.keys(data);
    if (keys.length === 0) return false;
    // Check if at least one field has a non-empty value
    return keys.some(key => {
      const value = data[key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value.trim() === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && Object.keys(value).length === 0) return false;
      return true;
    });
  };

  // Reset form when formData.step4 changes externally (e.g., when template is applied)
  // Use serialized comparison to avoid infinite loops
  useEffect(() => {
    if (!formData.step4) return;

    const currentSerialized = JSON.stringify(formData.step4);
    const hasData = hasMeaningfulData(formData.step4);
    
    // If this is the first time we have meaningful data, always reset
    if (prevStep4Ref.current === undefined && hasData) {
      const newValues = { ...formData.step4 };
      console.log("Step4: First time loading meaningful data, resetting with values:", newValues);
      reset(newValues, { keepDefaultValues: false });
      prevStep4Ref.current = currentSerialized;
      isInitialMount.current = false;
      return;
    }

    // If we previously had empty data and now have meaningful data, reset
    if (prevStep4Ref.current && prevStep4Ref.current === "{}" && hasData) {
      const newValues = { ...formData.step4 };
      console.log("Step4: Data loaded after empty initial state, resetting with values:", newValues);
      reset(newValues, { keepDefaultValues: false });
      prevStep4Ref.current = currentSerialized;
      return;
    }

    // For subsequent updates, only reset if:
    // 1. The formData actually changed (different from previous)
    // 2. The formData is different from current form values (external change, not from form itself)
    if (prevStep4Ref.current !== currentSerialized) {
      const currentFormValues = getValues();
      const currentFormSerialized = JSON.stringify(currentFormValues);
      
      // Only reset if formData is different from current form values
      // This means the change came from external source (template load, etc.)
      // If they match, it means the change came from the form itself, so don't reset
      if (currentFormSerialized !== currentSerialized) {
        const newValues = { ...formData.step4 };
        console.log("Step4: Resetting form with external values:", newValues);
        reset(newValues, { keepDefaultValues: false });
        prevStep4Ref.current = currentSerialized;
      } else {
        // Update the ref even if we don't reset, to track the change
        prevStep4Ref.current = currentSerialized;
      }
    } else if (prevStep4Ref.current === undefined) {
      // If prevStep4Ref is still undefined and we have data (even if empty), set it
      prevStep4Ref.current = currentSerialized;
    }
  }, [formData.step4, reset, getValues]);

  useEffect(() => {
    onValidationChange(isValid);
  }, [isValid, onValidationChange]);

  useEffect(() => {
    if (!watch("authenticationSignOff")) {
      setValue("options", undefined);
      setValue("userAttribute", undefined);
    }
  }, [watch("authenticationSignOff"), setValue]);

  useEffect(() => {
    const subscription = watch((values) => {
      setFormData((prev) => {
        // Only update if values actually changed to prevent infinite loops
        // Compare the entire step4 object to catch all field changes
        const currentSerialized = JSON.stringify(prev.step4 || {});
        const newSerialized = JSON.stringify(values);
        
        if (currentSerialized !== newSerialized) {
          return { ...prev, step4: values as Step4FormData };
        }
        return prev;
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, setFormData]);

  return (
    <div className="p-6 bg-white shadow-lg rounded-lg mx-auto">
      <h2 className="text-lg font-bold">General Settings</h2>
      <small className="text-gray-600 block mb-6">
        Determine Settings for Notification, Campaign Management and others.
      </small>

      <h2 className="font-medium"> Notification(s) </h2>
      <dl className="px-4 py-8 border-b border-gray-300 space-y-6 mb-8 text-sm">
        {/* Start of Campaign */}
        <dd className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-48">Start of Campaign</span>
            <div className="flex gap-2 items-center">
              No
              <ToggleSwitch
                checked={watch("startOfCampaign")}
                onChange={(checked) => {
                  setValue("startOfCampaign", checked);
                  if (!checked) {
                    setValue("startOfCampaignReminders", []);
                    setValue("startOfCampaignTemplateName", undefined);
                    setValue("startOfCampaignTemplateData", undefined);
                  }
                }}
              />
              Yes
            </div>
          </div>
          {watch("startOfCampaign") && (
            <div className="ml-52 flex items-center gap-3">
              {watch("startOfCampaignTemplateName")?.trim() ? (
                <>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-sm font-medium">
                    <BookTemplate size={14} className="text-blue-600" />
                    {watch("startOfCampaignTemplateName")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                    onClick={() => handleOpenTemplateEditor("start")}
                    title="Edit template"
                    aria-label="Edit template"
                  >
                    <Pencil size={18} aria-hidden />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                  onClick={() => handleOpenTemplateEditor("start")}
                  title="Select email template"
                  aria-label="Select email template"
                >
                  <MailPlus size={18} aria-hidden />
                </button>
              )}
            </div>
          )}
        </dd>

        {/* Reminders during Campaign */}
        <dd className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-48">Reminders during Campaign</span>
            <div className="flex gap-2 items-center flex-1">
              <div className="flex gap-2 items-center">
                No
                <ToggleSwitch
                  checked={watch("remindersDuringCampaign")}
                  onChange={(checked) => {
                    setValue("remindersDuringCampaign", checked);
                    if (!checked) {
                      setValue("remindersDuringCampaignReminders", []);
                      setValue("remindersDuringCampaignTemplateName", undefined);
                      setValue("remindersDuringCampaignTemplateData", undefined);
                    }
                  }}
                />
                Yes
              </div>
              {watch("remindersDuringCampaign") && (
                <div className="w-1/2 ml-4">
                  <CustomMultiSelectOnDay
                    control={control}
                    name="remindersDuringCampaignReminders"
                    options={duringCampaignWithoutStartOptions}
                    placeholder="Select reminders or add custom value"
                  />
                </div>
              )}
            </div>
          </div>
          {watch("remindersDuringCampaign") && (
            <div className="ml-52 space-y-2">
              <div className="flex items-center gap-3">
                {watch("remindersDuringCampaignTemplateName")?.trim() ? (
                  <>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-sm font-medium">
                      <BookTemplate size={14} className="text-blue-600" />
                      {watch("remindersDuringCampaignTemplateName")}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                      onClick={() => handleOpenTemplateEditor("reminders")}
                      title="Edit template"
                      aria-label="Edit template"
                    >
                      <Pencil size={18} aria-hidden />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                    onClick={() => handleOpenTemplateEditor("reminders")}
                    title="Select email template"
                    aria-label="Select email template"
                  >
                    <MailPlus size={18} aria-hidden />
                  </button>
                )}
              </div>
              {errors.remindersDuringCampaignReminders?.message &&
                typeof errors.remindersDuringCampaignReminders.message === "string" && (
                  <p className="text-red-500">{errors.remindersDuringCampaignReminders.message}</p>
                )}
            </div>
          )}
        </dd>

        {/* At Escalation */}
        <dd className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-48">At Escalation</span>
            <div className="flex gap-2 items-center flex-1">
              <div className="flex gap-2 items-center">
                No
                <ToggleSwitch
                  checked={watch("atEscalation")}
                  onChange={(checked) => {
                    setValue("atEscalation", checked);
                    if (!checked) {
                      setValue("atEscalationReminders", []);
                      setValue("atEscalationTemplateName", undefined);
                      setValue("atEscalationTemplateData", undefined);
                    }
                  }}
                />
                Yes
              </div>
              {watch("atEscalation") && (
                <div className="w-1/2 ml-4">
                  <CustomMultiSelectBeforeEscalation
                    control={control}
                    name="atEscalationReminders"
                    options={beforeEscalationOptions}
                    placeholder="every - days before escalation"
                  />
                </div>
              )}
            </div>
          </div>
          {watch("atEscalation") && (
            <div className="ml-52 space-y-2">
              <div className="flex items-center gap-3">
                {watch("atEscalationTemplateName")?.trim() ? (
                  <>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-sm font-medium">
                      <BookTemplate size={14} className="text-blue-600" />
                      {watch("atEscalationTemplateName")}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                      onClick={() => handleOpenTemplateEditor("escalation")}
                      title="Edit template"
                      aria-label="Edit template"
                    >
                      <Pencil size={18} aria-hidden />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                    onClick={() => handleOpenTemplateEditor("escalation")}
                    title="Select email template"
                    aria-label="Select email template"
                  >
                    <MailPlus size={18} aria-hidden />
                  </button>
                )}
              </div>
              {errors.atEscalationReminders?.message &&
                typeof errors.atEscalationReminders.message === "string" && (
                  <p className="text-red-500">{errors.atEscalationReminders.message}</p>
                )}
            </div>
          )}
        </dd>

        {/* Campaign Closure */}
        <dd className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-48">Campaign Closure</span>
            <div className="flex gap-2 items-center">
              No
              <ToggleSwitch
                checked={watch("campaignClosure")}
                onChange={(checked) => {
                  setValue("campaignClosure", checked);
                  if (!checked) {
                    setValue("campaignClosureTemplateName", undefined);
                    setValue("campaignClosureTemplateData", undefined);
                  }
                }}
              />
              Yes
            </div>
          </div>
          {watch("campaignClosure") && (
            <div className="ml-52 flex items-center gap-3">
              {watch("campaignClosureTemplateName")?.trim() ? (
                <>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 text-sm font-medium">
                    <BookTemplate size={14} className="text-blue-600" />
                    {watch("campaignClosureTemplateName")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                    onClick={() => handleOpenTemplateEditor("closure")}
                    title="Edit template"
                    aria-label="Edit template"
                  >
                    <Pencil size={18} aria-hidden />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-2 bg-white border border-green-600 text-green-600 cursor-pointer hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
                  onClick={() => handleOpenTemplateEditor("closure")}
                  title="Select email template"
                  aria-label="Select email template"
                >
                  <MailPlus size={18} aria-hidden />
                </button>
              )}
            </div>
          )}
        </dd>

        <dd className="grid grid-cols-2">
          <span>Integrate with Microsoft Teams for notification(s)</span>
          <div className="flex flex-col gap-2">
            <span className="flex gap-2 items-center">
              No
              <ToggleSwitch
                checked={watch("msTeamsNotification")}
                onChange={(checked) => {
                  setValue("msTeamsNotification", checked);
                  if (!checked) {
                    setValue("msTeamsChannelName", "");
                    setValue("msTeamsDescription", "");
                    setValue("msTeamsTeamId", "");
                  }
                }}
              />
              Yes
            </span>
            {watch("msTeamsNotification") && (
              <div className="flex flex-col gap-3 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Channel Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register("msTeamsChannelName")}
                    maxLength={50}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Provide channel name (no more than 50 characters)"
                  />
                  {errors.msTeamsChannelName?.message && (
                    <p className="text-red-500 text-sm mt-1">{errors.msTeamsChannelName.message}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {watch("msTeamsChannelName")?.length || 0}/50 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    {...register("msTeamsDescription")}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 resize-y"
                    placeholder="Enter description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team ID/Microsoft 365 Group ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register("msTeamsTeamId")}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter Team ID or Microsoft 365 Group ID"
                  />
                  {errors.msTeamsTeamId?.message && (
                    <p className="text-red-500 text-sm mt-1">{errors.msTeamsTeamId.message}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      // Trigger validation for Microsoft Teams fields
                      const msTeamsChannelName = watch("msTeamsChannelName");
                      const msTeamsTeamId = watch("msTeamsTeamId");
                      
                      // Check if required fields are filled
                      if (!msTeamsChannelName || !msTeamsTeamId) {
                        setMsTeamsSaveStatus("error");
                        setTimeout(() => setMsTeamsSaveStatus("idle"), 2000);
                        return;
                      }
                      
                      // Validate using form validation
                      const isValid = await getValues();
                      const channelNameError = errors.msTeamsChannelName;
                      const teamIdError = errors.msTeamsTeamId;
                      
                      if (channelNameError || teamIdError) {
                        setMsTeamsSaveStatus("error");
                        setTimeout(() => setMsTeamsSaveStatus("idle"), 2000);
                        return;
                      }
                      
                      // Save the data
                      setMsTeamsSaveStatus("saving");
                      
                      // Simulate save operation (data is already being saved via watch subscription)
                      setTimeout(() => {
                        setMsTeamsSaveStatus("saved");
                        setTimeout(() => setMsTeamsSaveStatus("idle"), 2000);
                      }, 500);
                    }}
                    className="flex gap-2 items-center bg-blue-600 text-white rounded-md px-4 py-2 cursor-pointer hover:bg-blue-700 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={msTeamsSaveStatus === "saving"}
                  >
                    <Save size={16} />
                    {msTeamsSaveStatus === "saving" 
                      ? "Saving..." 
                      : msTeamsSaveStatus === "saved" 
                      ? "Saved!" 
                      : msTeamsSaveStatus === "error"
                      ? "Error"
                      : "Save"}
                  </button>
                  {msTeamsSaveStatus === "saved" && (
                    <span className="text-sm text-green-600 font-medium">Microsoft Teams settings saved successfully</span>
                  )}
                  {msTeamsSaveStatus === "error" && (
                    <span className="text-sm text-red-600 font-medium">Please fill in all required fields</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </dd>
        <dd className="grid grid-cols-2">
          <span className="flex gap-2 items-center">
            Only allow Download/Upload on “Sharepoint/Corporate Network”
            <InfoIcon className=" text-gray-500" size={16} />
          </span>
          <span>
            <input
              type="checkbox"
              className="scale-130"
              {...register("allowDownloadUploadCropNetwork")}
            />
          </span>
        </dd>
      </dl>
      <h2 className="font-medium">Campaign Management</h2>
      <dl className="px-4 py-8 border-b border-gray-300 space-y-4 mb-8 grid grid-cols-2 text-sm">
        <dt> Mark undecided access as</dt>
        <dd>
          {isEntitlementOwnerTemplate ? (
            <MultiSelect
              isSearchable={false}
              isMulti={false}
              control={control as unknown as Control<FieldValues>}
              options={markUndecidedAccessOptions}
              placeholder="Select action"
              {...register("markUndecidedAccess")}
            />
          ) : (
            <div className="flex gap-2 items-center">
              <span
                className={`flex items-center ${
                  !watch("markUndecidedRevoke") ? ` text-black` : "text-black/50"
                }`}
              >
                {" "}
                Revoke
              </span>
              <ToggleSwitch
                checked={watch("markUndecidedRevoke")}
                onChange={(checked) => setValue("markUndecidedRevoke", checked)}
              />
              <span
                className={`flex items-center ${
                  watch("markUndecidedRevoke") ? ` text-black` : "text-black/50"
                }`}
              >
                Certify{" "}
              </span>
            </div>
          )}
        </dd>
        <dt> Disable Bulk Action</dt>
        <dd className="flex gap-2 items-center">
          {" "}
          No
          <ToggleSwitch
            checked={watch("disableBulkAction")}
            onChange={(checked) => setValue("disableBulkAction", checked)}
          />
          Yes{" "}
        </dd>
        <dt>Enforce Comments/Justification on </dt>
        <dd>
          <MultiSelect
            isSearchable={false}
            isMulti={false}
            control={control as unknown as Control<FieldValues>}
            options={enforceCommentsOptions}
            {...register("enforceComments")}
          />
          {errors.enforceComments?.message &&
            typeof errors.enforceComments.message === "string" && (
              <p className="text-red-500">{errors.enforceComments.message}</p>
            )}
          {showGenericExpression && (
            <div className="mt-4">
              <ExpressionBuilder
                title="Build Expressions"
                control={control as unknown as Control<FieldValues>}
                setValue={setValue as unknown as UseFormSetValue<FieldValues>}
                watch={watch as unknown as UseFormWatch<FieldValues>}
                fieldName={"genericExpression"}
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
              {errors.genericExpression?.message &&
                typeof errors.genericExpression.message === "string" && (
                  <p className="text-red-500">
                    {errors.genericExpression.message}
                  </p>
                )}
            </div>
          )}
        </dd>
      </dl>
      <h2 className="font-medium">Advanced Setting</h2>
      <dl className="px-4 border-b border-gray-300 py-8 space-y-4 mb-8 grid grid-cols-2 text-sm">
        <dt> Allow Escalation</dt>
        <dd className="flex gap-2 items-center">
          <input
            type="text"
            className="form-input !w-1/3"
            {...register("allowEscalation")}
          />
          <span> days before end of campaign.</span>
        </dd>

        <dt> If Certifier is Unavailable, then select user</dt>
        <dd>
          <MultiSelect
            placeholder="Select User(s)"
            control={control as unknown as Control<FieldValues>}
            isAsync
            loadOptions={loadUsers}
            components={{ Option: customOption }}
            {...register("certifierUnavailableUsers")}
          />
          {errors.certifierUnavailableUsers?.message &&
            typeof errors.certifierUnavailableUsers.message === "string" && (
              <p className="text-red-500">
                {errors.certifierUnavailableUsers.message}
              </p>
            )}
        </dd>

        {/* Hide these advanced options when editing/cloning Entitlement Owner templates */}
        {!isEntitlementOwnerTemplate && (
          <>
            <dt>
              Open ticket for Conditional Approval tasks with future termination
              date
            </dt>
            <dd className="flex gap-2 items-center">
              {" "}
              No
              <ToggleSwitch
                checked={watch("ticketConditionalApproval")}
                onChange={(checked) =>
                  setValue("ticketConditionalApproval", checked)
                }
              />
              Yes{" "}
            </dd>

            <dt>Application Scope </dt>
            <dd className="flex gap-2 items-center">
              <span
                className={`flex items-center ${
                  !watch("applicationScope") ? ` text-black` : "text-black/50"
                }`}
              >
                {" "}
                All Active Accounts
              </span>
              <ToggleSwitch
                checked={watch("applicationScope")}
                onChange={(checked) => setValue("applicationScope", checked)}
              />
              <span
                className={`flex items-center ${
                  watch("applicationScope") ? ` text-black` : "text-black/50"
                }`}
              >
                All User Accounts
              </span>
            </dd>

            <dt>Do you want to allow pre-delegate to sign off</dt>
            <dd className="flex gap-2 items-center">
              {" "}
              No
              <ToggleSwitch
                checked={watch("preDelegate")}
                onChange={(checked) => setValue("preDelegate", checked)}
              />
              Yes{" "}
            </dd>
          </>
        )}

        <dt>Enable additional Authentication for certification sign off(Password)</dt>
        <dd>
          <div className="flex gap-2 items-center">
            No
            <ToggleSwitch
              checked={watch("authenticationSignOff")}
              onChange={(checked) => setValue("authenticationSignOff", checked)}
            />
            Yes{" "}
          </div>

          {/* {watch("authenticationSignOff") && (
            <div className="grid grid-cols-2 gap-2 mt-6">
              <div>
                <span className={`flex items-center ${asterisk}`}>Options</span>
                <MultiSelect
                  placeholder="Select Option"
                  control={control as unknown as Control<FieldValues>}
                  isMulti={false}
                  options={optionsData}
                  isSearchable={false}
                  {...register("options")}
                />
              </div>

              {}
            </div>
          )} */}
        </dd>
      </dl>
    </div>
  );
};

export default Step4;
