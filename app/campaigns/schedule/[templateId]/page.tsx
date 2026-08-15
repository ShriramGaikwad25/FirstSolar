"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useForm, Control, FieldValues } from "react-hook-form";
import { createPortal } from "react-dom";
import { Play, X, RotateCcw, Clock, Calendar, Repeat, CheckCircle, AlertCircle, Zap, Infinity, Edit2, Save } from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import { customOption, loadUsers, loadIspmApps } from "@/components/MsAsyncData";
import { asterisk, userGroups, excludeUsers, defaultExpression } from "@/utils/utils";
import ToggleSwitch from "@/components/ToggleSwitch";
import FileDropzone from "@/components/FileDropzone";
import DateInput from "@/components/DatePicker";
import { executeQuery, scheduleCampaign, updateCampaignSchedule } from "@/lib/api";
import { apiRequestWithAuth, getCookie, COOKIE_NAMES } from "@/lib/auth";

// Common timezones list
const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "America/New_York", label: "US East" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Los_Angeles", label: "US West" },
  { value: "Europe/London", label: "UK" },
  { value: "Europe/Berlin", label: "Germany" },
  { value: "Australia/Sydney", label: "Australia" },
  { value: "Asia/Tokyo", label: "Japan" },
  { value: "Asia/Shanghai", label: "China" },
];

const SchedulePage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.templateId as string;
  const templateNameFromQuery = searchParams?.get("name");
  const templateName = templateNameFromQuery ? decodeURIComponent(templateNameFromQuery) : "Template";
  const campaignId = searchParams?.get("campaignId") || null;
  const fromTab = searchParams?.get("fromTab") || searchParams?.get("tab") || null;
  const campaignsBackUrl = fromTab === "template" ? "/campaigns?tab=template" : "/campaigns";
  
  const [template, setTemplate] = useState<any>(null);
  const [showRunNowModal, setShowRunNowModal] = useState(false);
  const [showStagingForm, setShowStagingForm] = useState(false);
  const [stagingTiming, setStagingTiming] = useState("Before First Run Only");
  const [stagingDuration, setStagingDuration] = useState("");
  const [stagingDurationUnit, setStagingDurationUnit] = useState("Days");
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  // Triggers state
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggersError, setTriggersError] = useState<string | null>(null);
  const [triggersData, setTriggersData] = useState<any>(null);
  // Run history state
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);
  const [runHistoryData, setRunHistoryData] = useState<any[]>([]);
  // Edit next fire time state
  const [editingNextFireTime, setEditingNextFireTime] = useState<number | null>(null);
  const [editedNextFireTime, setEditedNextFireTime] = useState<Date | null>(null);
  const [isSavingNextFireTime, setIsSavingNextFireTime] = useState(false);
  // Edit scheduling state
  const [isEditingScheduling, setIsEditingScheduling] = useState(false);
  const [isSavingScheduling, setIsSavingScheduling] = useState(false);

  // Transform template name: replace spaces with underscores and convert to lowercase
  const transformTemplateName = (name: string): string => {
    return name.replace(/\s+/g, '_').toLowerCase();
  };

  // Fetch triggers - calls external API directly
  const fetchTriggers = async (templateName: string) => {
    try {
      setTriggersLoading(true);
      setTriggersError(null);

      // Transform template name: replace spaces with underscores and convert to lowercase
      const transformedName = transformTemplateName(templateName);

      // Call external API directly
      const endpoint = `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/campaign/${transformedName}`;
      
      const data = await apiRequestWithAuth<any>(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "ISPM-Scheduler/1.0",
        },
      });

      // If the response contains an error, treat it as "no triggers" instead of surfacing an error
      if (data && typeof data === "object" && (data.message || data.error)) {
        console.warn("Scheduler returned error for triggers, showing empty list instead:", data);
        setTriggersData({ triggers: [] });
        return;
      }

      // Set the triggers data (or an empty list fallback)
      if (data && Array.isArray((data as any).triggers)) {
        setTriggersData(data);
      } else {
        setTriggersData({ triggers: [] });
      }
    } catch (err) {
      console.error("Error fetching triggers:", err);
      // On any error, keep UI clean and just show empty triggers
      setTriggersError(null);
      setTriggersData({ triggers: [] });
    } finally {
      setTriggersLoading(false);
    }
  };

  // Fetch run history - calls external API directly
  const fetchRunHistory = async (templateName: string) => {
    try {
      setRunHistoryLoading(true);
      setRunHistoryError(null);

      // Transform template name: replace spaces with underscores and convert to lowercase
      const transformedName = transformTemplateName(templateName);

      // Call external API directly
      const endpoint = `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/history/campaign/${transformedName}`;
      
      const data = await apiRequestWithAuth<any>(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "ISPM-Scheduler/1.0",
        },
      });

      // Check if the response contains an error
      if (data && typeof data === "object" && (data.message || data.error)) {
        throw new Error(data.message || data.error);
      }

      // Set the history data (should be an array)
      setRunHistoryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching run history:", err);
      setRunHistoryError(
        err instanceof Error ? err.message : "Failed to fetch run history"
      );
      setRunHistoryData([]);
    } finally {
      setRunHistoryLoading(false);
    }
  };

  // Fetch template data from API
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) return;
      
      try {
        // Try to fetch campaign by ID
        let templateData: any = null;
        try {
          templateData = await apiRequestWithAuth<any>(
            `https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getCampaign/${templateId}`,
            { method: "GET" }
          );
        } catch (firstError) {
          // Fallback: Get all campaigns and find the matching one
          try {
            const allCampaigns = await apiRequestWithAuth<any>(
              "https://preview.keyforge.ai/campaign/api/v1/ACMECOM/getAllCampaigns",
              { method: "GET" }
            );
            
            let campaignsArray: any[] = [];
            if (Array.isArray(allCampaigns)) {
              campaignsArray = allCampaigns;
            } else if (allCampaigns && typeof allCampaigns === "object") {
              campaignsArray = allCampaigns.items || allCampaigns.data || allCampaigns.campaigns || allCampaigns.results || [];
            }
            
            templateData = campaignsArray.find(
              (campaign: any) =>
                campaign.id === templateId ||
                campaign.campaignID === templateId ||
                campaign.campaignId === templateId
            );
          } catch (secondError) {
            console.error("Error fetching template:", secondError);
            // Use fallback data from query params
            templateData = null;
          }
        }

        if (templateData) {
          // Extract duration from certificationDuration or step3 duration
          const duration = templateData.certificationDuration 
            ? `${templateData.certificationDuration} days`
            : templateData.duration || "";
          
          setTemplate({
            id: templateId,
            name: templateData.name || templateName,
            description: templateData.description || "",
            duration: duration,
            userType: templateData.userType || "All users",
            selectData: templateData.selectData || "All Applications",
          });
        } else {
          // Fallback to query params if API fails
          setTemplate({
            id: templateId,
            name: templateName,
            description: "",
            duration: "",
            userType: "All users",
            selectData: "All Applications",
          });
        }
      } catch (error) {
        console.error("Error fetching template data:", error);
        // Fallback to query params on error
        setTemplate({
          id: templateId,
          name: templateName,
          description: "",
          duration: "",
          userType: "All users",
          selectData: "All Applications",
        });
      }
    };

    fetchTemplate();
  }, [templateId, templateName]);


  // Fetch triggers and run history when templateId or template name is available
  useEffect(() => {
    if (templateId) {
      // For triggers and run history, use template name (from template object or query param)
      const templateNameToUse = template?.name || templateName;
      if (templateNameToUse) {
        fetchTriggers(templateNameToUse);
        fetchRunHistory(templateNameToUse);
      }
    }
  }, [templateId, template, templateName]);

  // Ensure DatePicker and timezone select have same width
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .date-picker-wrapper .rmdp-container,
      .date-picker-wrapper .rmdp-input {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

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
      certificationTemplate: template?.name || "",
      description: template?.description || "",
      duration: template?.duration || "",
      userType: template?.userType || "All users",
      selectData: template?.selectData || "All Applications",
      specificUserExpression: template?.specificUserExpression || [defaultExpression],
      specificApps: template?.specificApps || [],
      expressionApps: template?.expressionApps || [],
      expressionEntitlement: template?.expressionEntitlement || [defaultExpression],
      groupListIsChecked: template?.groupListIsChecked || false,
      userGroupList: template?.userGroupList || "",
      excludeUsersIsChecked: template?.excludeUsersIsChecked || false,
      excludeUsers: template?.excludeUsers || "",
      // Scheduling fields
      startDate: null,
      timezone: (() => {
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Check if user's timezone is in our common list, otherwise default to UTC
        return COMMON_TIMEZONES.some(tz => tz.value === userTz) ? userTz : "UTC";
      })(),
      runOnceOnly: false,
      recurrenceNumber: "",
      recurrenceUnit: "Days",
      endCondition: "Never",
      endDate: null,
      numberOfOccurrences: "",
      enableStaging: "No",
      stagingTiming: "Before First Run Only",
      stagingDuration: "",
      stagingDurationUnit: "Days",
    },
  });

  useEffect(() => {
    if (template) {
      setValue("certificationTemplate", template.name || "");
      setValue("description", template.description || "");
      setValue("duration", template.duration || "");
      setValue("userType", template.userType || "All users");
      setValue("selectData", template.selectData || "All Applications");
    }
  }, [template, setValue]);

  // Populate form fields when triggers data is available
  useEffect(() => {
    if (triggersData?.data) {
      const data = triggersData.data;
      
      // Set scheduling fields
      if (data.startDate) {
        setValue("startDate", new Date(data.startDate));
      }
      if (data.zoneId) {
        setValue("timezone", data.zoneId);
      }
      if (data.runItOnce) {
        setValue("runOnceOnly", data.runItOnce === "YES");
      }
      if (data.neverEnds) {
        setValue("endCondition", data.neverEnds === "YES" ? "Never" : "On");
      }
      if (data.endsOn && data.neverEnds === "NO") {
        setValue("endDate", new Date(data.endsOn));
      }
      if (data.enableStaging) {
        setValue("enableStaging", data.enableStaging === "YES" ? "Yes" : "No");
      }
      
      // Set recurrence fields
      if (data.frequency) {
        setValue("recurrenceNumber", data.frequency.periodValue);
        setValue("recurrenceUnit", data.frequency.period.charAt(0) + data.frequency.period.slice(1).toLowerCase());
      }
    }
  }, [triggersData, setValue]);

  const userType = watch("userType");
  const groupListIsChecked = watch("groupListIsChecked");
  const excludeUsersIsChecked = watch("excludeUsersIsChecked");
  const selectData = watch("selectData");
  const runOnceOnly = watch("runOnceOnly");
  const endCondition = watch("endCondition");
  const enableStaging = watch("enableStaging");

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

  const onSubmit = async (data: any) => {
    try {
      setIsScheduling(true);
      
      // Get the campaign ID to use (from URL param or template ID)
      const idToUse = campaignId || templateId;
      if (!idToUse) {
        alert("Error: No campaign ID found. Cannot schedule campaign.");
        setIsScheduling(false);
        return;
      }

      // Format start date with time
      let startDateISO = "";
      if (data.startDate) {
        const startDate = new Date(data.startDate);
        // Format as ISO string: YYYY-MM-DDTHH:mm:ss
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        startDateISO = `${year}-${month}-${day}T00:00:00`;
      } else {
        alert("Error: Start date is required.");
        setIsScheduling(false);
        return;
      }

      // Format end date if provided
      let endsOnISO: string | undefined = undefined;
      if (data.endCondition === "On" && data.endDate) {
        const endDate = new Date(data.endDate);
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, '0');
        const day = String(endDate.getDate()).padStart(2, '0');
        endsOnISO = `${year}-${month}-${day}T00:00:00`;
      }

      // Build the payload - ensure endsOn is present when neverEnds is "NO"
      const payload: any = {
        campaignName: data.certificationTemplate || template?.name || "Campaign",
        campaignId: idToUse,
        description: data.description || "",
        startDate: startDateISO,
        zoneId: data.timezone || "UTC",
        runItOnce: data.runOnceOnly ? "YES" : "NO",
        neverEnds: data.endCondition === "Never" ? "YES" : "NO",
        enableStaging: data.enableStaging === "Yes" ? "YES" : "NO",
      };

      // Add end date - required when neverEnds is "NO" (endCondition is "On")
      if (data.endCondition === "On") {
        if (endsOnISO) {
          payload.endsOn = endsOnISO;
        } else {
          // If end condition is "On" but no end date provided, show error
          alert("Error: End date is required when end condition is 'On'.");
          setIsScheduling(false);
          return;
        }
      }

      // Frequency - only include when runItOnce is "NO" (recurring)
      if (!data.runOnceOnly) {
        if (data.recurrenceNumber && data.recurrenceUnit) {
          payload.frequency = {
            period: data.recurrenceUnit.toUpperCase(),
            periodValue: data.recurrenceNumber.toString(),
          };
        } else {
          // Default frequency if recurring but no values provided
          payload.frequency = {
            period: "DAYS",
            periodValue: "1",
          };
        }
      }
      // Note: When runItOnce is "YES", frequency is not included (one-time run)

      // Log the complete payload for debugging
      console.log("=== SCHEDULE CAMPAIGN PAYLOAD ===");
      console.log("Form Data:", data);
      console.log("Template:", template);
      console.log("Campaign ID:", idToUse);
      console.log("Final Payload:", JSON.stringify(payload, null, 2));

      // Validate required fields
      if (!payload.campaignName || !payload.campaignId || !payload.startDate) {
        alert("Error: Missing required fields. Please check campaign name, ID, and start date.");
        setIsScheduling(false);
        return;
      }

      // Call the API
      const result = await scheduleCampaign(payload);
      
      console.log("Campaign scheduled successfully:", result);
      alert("Campaign scheduled successfully!");
      router.push(campaignsBackUrl);
    } catch (error) {
      console.error("Error scheduling campaign:", error);
      alert(`Failed to schedule campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleRunNowClick = async () => {
    // Get template name and transform it
    const templateNameToUse = template?.name || templateName;
    if (!templateNameToUse) {
      alert("Error: Template name not found. Cannot trigger job.");
      return;
    }

    const transformedName = transformTemplateName(templateNameToUse);
    const endpoint = `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/campaign/${transformedName}/trigger`;

    setIsStartingCampaign(true);

    try {
      console.log("Triggering job:", transformedName);
      console.log("API endpoint:", endpoint);

      // Get JWT token for authentication
      const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
      
      // Make direct fetch call to handle text response
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "ISPM-Scheduler/1.0",
          ...(jwtToken ? { "Authorization": `Bearer ${jwtToken}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to trigger job: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Read response as text (API returns plain text like "Triggered ...")
      const responseText = await response.text();
      console.log("Job triggered successfully. Response:", responseText);
      
      setIsStartingCampaign(false);
      alert("Job triggered successfully!");
      
      // Refresh triggers and run history to show updated status
      if (templateNameToUse) {
        fetchTriggers(templateNameToUse);
        fetchRunHistory(templateNameToUse);
      }
    } catch (error) {
      console.error("Error triggering job:", error);
      setIsStartingCampaign(false);
      alert(`Failed to trigger job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRunNow = async () => {
    // Handle run now - execute campaign immediately
    const formData = watch();
    console.log("Run Now clicked - formData:", formData);
    console.log("Campaign ID from URL:", campaignId);
    console.log("Template ID from URL:", templateId);
    
    // Use campaignId from manage campaign page, or fallback to templateId
    const idToUse = campaignId || templateId;
    
    if (!idToUse) {
      console.error("No campaign ID or template ID available");
      alert("Error: No campaign ID found. Cannot start campaign.");
      return;
    }
    
    setIsStartingCampaign(true);
    
    try {
      console.log("Calling API to start campaign with ID:", idToUse);
      console.log("API endpoint: https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery");
      console.log("Query: CALL kf_start_campaign(?::uuid)");
      console.log("Parameters:", [idToUse]);
      
      const result = await executeQuery(
        "CALL kf_start_campaign(?::uuid)",
        [idToUse]
      );
      
      console.log("API call successful, result:", result);
      setIsStartingCampaign(false);
      setShowRunNowModal(false);
      setShowStagingForm(false);
      alert("Campaign started successfully!");
      router.push(campaignsBackUrl);
    } catch (error) {
      console.error("Error starting campaign:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setIsStartingCampaign(false);
      setShowRunNowModal(false);
      setShowStagingForm(false);
      alert(`Failed to start campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStagingClick = () => {
    setShowStagingForm(true);
  };

  const handleStagingSubmit = () => {
    // Handle staging - run with staging enabled
    const formData = watch();
    const stagingData = {
      ...formData,
      enableStaging: "Yes",
      stagingTiming,
      stagingDuration,
      stagingDurationUnit,
    };
    console.log("Staging data:", stagingData);
    // TODO: Call API to run the campaign with staging
    setShowRunNowModal(false);
    setShowStagingForm(false);
    alert("Campaign started with staging successfully!");
    router.push(campaignsBackUrl);
  };

  const handleEditNextFireTime = (triggerIndex: number, currentNextFireTime: string) => {
    setEditingNextFireTime(triggerIndex);
    setEditedNextFireTime(new Date(currentNextFireTime));
  };

  const handleCancelEditNextFireTime = () => {
    setEditingNextFireTime(null);
    setEditedNextFireTime(null);
  };

  const handleSaveNextFireTime = async (triggerIndex: number, triggerName: string) => {
    if (!editedNextFireTime) {
      return;
    }

    setIsSavingNextFireTime(true);
    try {
      // Get current form data to build update payload
      const formData = watch();
      const idToUse = campaignId || templateId;
      
      if (!idToUse) {
        setIsSavingNextFireTime(false);
        return;
      }

      // Format the edited next fire time as startDate (YYYY-MM-DD format)
      const year = editedNextFireTime.getFullYear();
      const month = String(editedNextFireTime.getMonth() + 1).padStart(2, '0');
      const day = String(editedNextFireTime.getDate()).padStart(2, '0');
      const newStartDate = `${year}-${month}-${day}`;

      // Format end date if provided
      let endsOnDate: string | undefined = undefined;
      if (formData.endCondition === "On" && formData.endDate) {
        const endDate = new Date(formData.endDate);
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        endsOnDate = `${endYear}-${endMonth}-${endDay}`;
      }

      // Build the update payload
      const payload: any = {
        campaignName: formData.certificationTemplate || template?.name || "Campaign",
        campaignId: idToUse,
        description: formData.description || "",
        startDate: newStartDate,
        zoneId: formData.timezone || "UTC",
        runItOnce: formData.runOnceOnly ? "YES" : "NO",
        neverEnds: formData.endCondition === "Never" ? "YES" : "NO",
        enableStaging: formData.enableStaging === "Yes" ? "YES" : "NO",
      };

      // Add end date if provided
      if (formData.endCondition === "On" && endsOnDate) {
        payload.endsOn = endsOnDate;
      }

      // Add frequency if recurring
      if (!formData.runOnceOnly) {
        if (formData.recurrenceNumber && formData.recurrenceUnit) {
          payload.frequency = {
            period: formData.recurrenceUnit.toUpperCase(),
            periodValue: formData.recurrenceNumber.toString(),
          };
        } else {
          payload.frequency = {
            period: "DAYS",
            periodValue: "1",
          };
        }
      }

      console.log("Updating schedule with payload:", JSON.stringify(payload, null, 2));

      // Call the update schedule API
      const result = await updateCampaignSchedule(payload);
      
      console.log("Schedule updated successfully:", result);
      
      // Update the triggers data locally
      if (triggersData?.triggers && triggersData.triggers[triggerIndex]) {
        const updatedTriggers = [...triggersData.triggers];
        updatedTriggers[triggerIndex] = {
          ...updatedTriggers[triggerIndex],
          nextFireTime: editedNextFireTime.toISOString(),
        };
        setTriggersData({
          ...triggersData,
          triggers: updatedTriggers,
        });
      }

      setEditingNextFireTime(null);
      setEditedNextFireTime(null);
      
      // Refresh triggers to get updated data
      const templateNameToUse = template?.name || templateName;
      if (templateNameToUse) {
        fetchTriggers(templateNameToUse);
      }
    } catch (error) {
      console.error("Error updating schedule:", error);
    } finally {
      setIsSavingNextFireTime(false);
    }
  };

  const handleSaveScheduling = async () => {
    setIsSavingScheduling(true);
    try {
      const formData = watch();
      const idToUse = campaignId || templateId;
      
      if (!idToUse) {
        alert("Error: No campaign ID found. Cannot update schedule.");
        setIsSavingScheduling(false);
        return;
      }

      // Format start date (YYYY-MM-DD format)
      let startDateFormatted = "";
      if (formData.startDate) {
        const startDate = new Date(formData.startDate);
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        startDateFormatted = `${year}-${month}-${day}`;
      } else {
        alert("Error: Start date is required.");
        setIsSavingScheduling(false);
        return;
      }

      // Format end date if provided
      let endsOnDate: string | undefined = undefined;
      if (formData.endCondition === "On" && formData.endDate) {
        const endDate = new Date(formData.endDate);
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDate.getDate()).padStart(2, '0');
        endsOnDate = `${endYear}-${endMonth}-${endDay}`;
      }

      // Build the update payload
      const payload: any = {
        campaignName: formData.certificationTemplate || template?.name || "Campaign",
        campaignId: idToUse,
        description: formData.description || "",
        startDate: startDateFormatted,
        zoneId: formData.timezone || "UTC",
        runItOnce: formData.runOnceOnly ? "YES" : "NO",
        neverEnds: formData.endCondition === "Never" ? "YES" : "NO",
        enableStaging: formData.enableStaging === "Yes" ? "YES" : "NO",
      };

      // Add end date if provided
      if (formData.endCondition === "On" && endsOnDate) {
        payload.endsOn = endsOnDate;
      }

      // Add frequency if recurring
      if (!formData.runOnceOnly) {
        if (formData.recurrenceNumber && formData.recurrenceUnit) {
          payload.frequency = {
            period: formData.recurrenceUnit.toUpperCase(),
            periodValue: formData.recurrenceNumber.toString(),
          };
        } else {
          payload.frequency = {
            period: "DAYS",
            periodValue: "1",
          };
        }
      }

      console.log("Updating schedule with payload:", JSON.stringify(payload, null, 2));

      // Call the update schedule API
      const result = await updateCampaignSchedule(payload);
      
      console.log("Schedule updated successfully:", result);
      
      setIsEditingScheduling(false);
      
      // Refresh triggers to get updated data
      const templateNameToUse = template?.name || templateName;
      if (templateNameToUse) {
        fetchTriggers(templateNameToUse);
      }
      
      alert("Schedule updated successfully!");
    } catch (error) {
      console.error("Error updating schedule:", error);
      alert(`Failed to update schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingScheduling(false);
    }
  };

  const handleCancelEditScheduling = () => {
    // Reset form to original values from triggersData if available
    if (triggersData?.data) {
      const data = triggersData.data;
      
      if (data.startDate) {
        setValue("startDate", new Date(data.startDate));
      }
      if (data.zoneId) {
        setValue("timezone", data.zoneId);
      }
      if (data.runItOnce) {
        setValue("runOnceOnly", data.runItOnce === "YES");
      }
      if (data.neverEnds) {
        setValue("endCondition", data.neverEnds === "YES" ? "Never" : "On");
      }
      if (data.endsOn && data.neverEnds === "NO") {
        setValue("endDate", new Date(data.endsOn));
      }
      if (data.enableStaging) {
        setValue("enableStaging", data.enableStaging === "YES" ? "Yes" : "No");
      }
      
      // Set recurrence fields
      if (data.frequency) {
        setValue("recurrenceNumber", data.frequency.periodValue);
        setValue("recurrenceUnit", data.frequency.period.charAt(0) + data.frequency.period.slice(1).toLowerCase());
      }
    }
    
    setIsEditingScheduling(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Schedule Template</h1>
        </div>

        {/* Two-part layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Part: Schedule Form */}
          <div className="space-y-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information and Scheduling Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 pb-3 border-b border-gray-200">Basic Information</h2>
            <div className="space-y-6 mb-6">
              {/* Template Name */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">
                  Template Name
                </label>
                <div className="w-full max-w-md">
                  <p className="text-sm text-gray-900 pt-2">
                    {watch("certificationTemplate") || template?.name || "N/A"}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">
                  Description
                </label>
                <div className="w-full max-w-md">
                  <p className="text-sm text-gray-900 pt-2">
                    {watch("description") || template?.description || "N/A"}
                  </p>
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                <label className="text-sm font-medium text-gray-700 pt-2">
                  Duration
                </label>
                <div className="w-full max-w-md">
                  <p className="text-sm text-gray-900 pt-2">
                    {watch("duration") || template?.duration || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 pb-3 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-900">Scheduling</h2>
              {isEditingScheduling ? (
                <button
                  type="button"
                  onClick={handleCancelEditScheduling}
                  disabled={isSavingScheduling}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingScheduling(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-6">
              {/* Start Date */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                <label className={`text-sm font-medium text-gray-700 pt-2 ${asterisk}`}>
                  Start Date
                </label>
                <div className="w-full max-w-[224px] space-y-3">
                  <div className="w-full date-picker-wrapper">
                    <DateInput
                      control={control as unknown as Control<FieldValues>}
                      name="startDate"
                      disabled={!isEditingScheduling}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="w-full">
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      disabled={!isEditingScheduling}
                      {...register("timezone")}
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.startDate?.message &&
                    typeof errors.startDate.message === "string" && (
                      <p className="text-red-500 text-sm mt-1">{errors.startDate.message}</p>
                    )}
                </div>
              </div>

              {/* Run Once Only */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-center">
                <label className="text-sm font-medium text-gray-700">
                  Run Once Only
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register("runOnceOnly")}
                    disabled={!isEditingScheduling}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <label className="text-sm font-medium text-gray-700 cursor-pointer">Run it once only</label>
                </div>
              </div>

              {/* Recurrence Section */}
              {!runOnceOnly && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 mb-4 pt-2 border-t border-gray-200">Recurrence</h3>
                  {/* Frequency */}
                  <div className="grid grid-cols-[200px_1fr] gap-6 items-center">
                    <label className="text-sm font-medium text-gray-700">Frequency</label>
                    <div className="flex items-center gap-3 w-full max-w-md">
                      <input
                        type="number"
                        min="1"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Number"
                        disabled={!isEditingScheduling}
                        {...register("recurrenceNumber")}
                      />
                      <span className="text-gray-600 font-medium">—</span>
                      <select
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={!isEditingScheduling}
                        {...register("recurrenceUnit")}
                      >
                        <option value="Days">Days</option>
                        <option value="Months">Months</option>
                      </select>
                    </div>
                  </div>

                  {/* Ends */}
                  <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                    <label className={`text-sm font-medium text-gray-700 pt-2 ${asterisk}`}>
                      Ends
                    </label>
                    <div className="w-full max-w-[224px] space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm text-gray-700 ${endCondition === "Never" ? "text-black" : "text-gray-400"}`}>
                          Never
                        </span>
                        <ToggleSwitch
                          checked={endCondition === "On"}
                          onChange={(checked) => setValue("endCondition", checked ? "On" : "Never")}
                          disabled={!isEditingScheduling}
                        />
                        <span className={`text-sm text-gray-700 ${endCondition === "On" ? "text-black" : "text-gray-400"}`}>
                          On
                        </span>
                      </div>
                      {endCondition === "On" && (
                        <div className="w-full date-picker-wrapper">
                          <DateInput
                            control={control as unknown as Control<FieldValues>}
                            name="endDate"
                            disabled={!isEditingScheduling}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Enable Staging */}
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                <label className={`text-sm font-medium text-gray-700 pt-2 ${asterisk}`}>
                  Enable Staging
                </label>
                <div className="w-full max-w-[224px] flex items-center gap-8">
                  <span className={`text-sm text-gray-700 ${enableStaging === "No" ? "text-black" : "text-gray-400"}`}>
                    No
                  </span>
                  <ToggleSwitch
                    checked={enableStaging === "Yes"}
                    onChange={(checked) => setValue("enableStaging", checked ? "Yes" : "No")}
                    disabled={!isEditingScheduling}
                  />
                  <span className={`text-sm text-gray-700 ${enableStaging === "Yes" ? "text-black" : "text-gray-400"}`}>
                    Yes
                  </span>
                </div>
              </div>

              {/* Staging Duration - shown when Enable Staging is Yes */}
              {enableStaging === "Yes" && (
                <div className="grid grid-cols-[200px_1fr] gap-6 items-center">
                  <label className="text-sm font-medium text-gray-700">Staging Duration</label>
                  <div className="flex items-center gap-3 w-full max-w-md">
                    <input
                      type="number"
                      min="1"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Number"
                      {...register("stagingDuration")}
                    />
                    <span className="text-gray-600 font-medium">—</span>
                    <select
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      {...register("stagingDurationUnit")}
                    >
                      <option value="Days">Days</option>
                      <option value="Weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with Schedule Button */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-end">
              <button
                type={isEditingScheduling ? "button" : "submit"}
                onClick={isEditingScheduling ? handleSaveScheduling : undefined}
                disabled={isScheduling || isSavingScheduling}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isScheduling || isSavingScheduling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isEditingScheduling ? "Updating..." : "Scheduling..."}
                  </>
                ) : (
                  isEditingScheduling ? "Update" : "Schedule"
                )}
              </button>
            </div>
          </div>
            </form>
          </div>

          {/* Right Part: Triggers and Run History Section */}
          <div className="space-y-8">
            {/* Triggers Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Triggers</h2>
                <button
                  type="button"
                  onClick={handleRunNowClick}
                  disabled={isStartingCampaign}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStartingCampaign ? (
                    <RotateCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isStartingCampaign ? "Triggering..." : "Run Now"}
                </button>
              </div>
              
              {triggersLoading ? (
                <div className="flex items-center gap-3 py-8">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading triggers...</p>
                </div>
              ) : triggersError ? (
                <div className="py-4 px-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600">Error: {triggersError}</p>
                </div>
              ) : !triggersData ? (
                <div className="text-center py-8 text-gray-500 italic">
                  <p>No trigger information available</p>
                  <p className="text-sm mt-2">Schedule the campaign to see trigger details</p>
                </div>
              ) : triggersData.triggers && Array.isArray(triggersData.triggers) && triggersData.triggers.length > 0 ? (
                <div className="space-y-4">
                  {triggersData.triggers.map((trigger: any, index: number) => {
                    const triggerState = trigger.triggerState?.toLowerCase() || "unknown";
                    const isNormal = triggerState === "normal";
                    const borderColor = isNormal ? "border-green-200" : triggerState === "paused" ? "border-yellow-200" : "border-gray-200";
                    
                    return (
                      <div key={index} className={`border-2 ${borderColor} rounded-lg p-3 bg-gray-100 shadow-sm hover:shadow-md transition-all duration-200`}>
                        {/* Header with State Badge */}
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                          <div className="flex items-center gap-1.5">
                            <Zap className={`w-4 h-4 ${isNormal ? 'text-green-600' : triggerState === 'paused' ? 'text-yellow-600' : 'text-gray-600'}`} />
                            <h3 className="text-sm font-semibold text-gray-800">Trigger Details</h3>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                            isNormal
                              ? "bg-green-100 text-green-800 border border-green-200" 
                              : triggerState === "paused"
                              ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                              : "bg-gray-100 text-gray-800 border border-gray-200"
                          }`}>
                            {isNormal && <CheckCircle className="w-3 h-3" />}
                            {triggerState === "paused" && <AlertCircle className="w-3 h-3" />}
                            {trigger.triggerState || "N/A"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          {/* Trigger Name */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                              <Zap className="w-3 h-3" />
                              Trigger Name
                            </div>
                            <div className="text-xs font-medium text-gray-900 break-words bg-white/60 rounded px-2 py-1 border border-gray-200">
                              {trigger.triggerName || "N/A"}
                            </div>
                          </div>

                          {/* Trigger Group */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                              <Zap className="w-3 h-3" />
                              Trigger Group
                            </div>
                            <div className="text-xs font-medium text-gray-900 break-words bg-white/60 rounded px-2 py-1 border border-gray-200">
                              {trigger.triggerGroup || "N/A"}
                            </div>
                          </div>

                          {/* Type */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                              <Zap className="w-3 h-3" />
                              Type
                            </div>
                            <div className="text-xs font-medium text-gray-900 bg-white/60 rounded px-2 py-1 border border-gray-200">
                              {trigger.type || "N/A"}
                            </div>
                          </div>

                          {/* Interval */}
                          {trigger.intervalMs && (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                                <Clock className="w-3 h-3" />
                                Interval
                              </div>
                              <div className="text-xs font-medium text-gray-900 bg-white/60 rounded px-2 py-1 border border-gray-200">
                                {(() => {
                                  const ms = trigger.intervalMs;
                                  const days = ms / (1000 * 60 * 60 * 24);
                                  if (days >= 1) {
                                    const daysRounded = Math.round(days * 10) / 10;
                                    const daysDisplay = daysRounded % 1 === 0 ? daysRounded.toString() : daysRounded.toFixed(1);
                                    return `${daysDisplay} day${daysRounded !== 1 ? 's' : ''}`;
                                  } else {
                                    const hours = ms / (1000 * 60 * 60);
                                    if (hours >= 1) {
                                      const hoursRounded = Math.round(hours * 10) / 10;
                                      const hoursDisplay = hoursRounded % 1 === 0 ? hoursRounded.toString() : hoursRounded.toFixed(1);
                                      return `${hoursDisplay} hour${hoursRounded !== 1 ? 's' : ''}`;
                                    } else {
                                      const minutes = ms / (1000 * 60);
                                      const minutesRounded = Math.round(minutes * 10) / 10;
                                      const minutesDisplay = minutesRounded % 1 === 0 ? minutesRounded.toString() : minutesRounded.toFixed(1);
                                      return `${minutesDisplay} minute${minutesRounded !== 1 ? 's' : ''}`;
                                    }
                                  }
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Repeat Count */}
                          {trigger.repeatCount !== undefined && (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                                <Repeat className="w-3 h-3" />
                                Repeat Count
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-900 bg-white/60 rounded px-2 py-1 border border-gray-200">
                                {trigger.repeatCount === -1 && <Infinity className="w-3 h-3 text-blue-600" />}
                                {trigger.repeatCount === -1 ? "Infinite" : trigger.repeatCount}
                              </div>
                            </div>
                          )}

                          {/* Previous Fire Time */}
                          {trigger.previousFireTime && (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                                <Calendar className="w-3 h-3" />
                                Previous Fire Time
                              </div>
                              <div className="text-xs font-medium text-gray-700 bg-white/60 rounded px-2 py-1 border border-gray-200">
                                {new Date(trigger.previousFireTime).toLocaleString()}
                              </div>
                            </div>
                          )}

                          {/* Next Fire Time */}
                          {trigger.nextFireTime && (
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-gray-600 mb-1">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  Next Fire Time
                                </div>
                                {editingNextFireTime === index ? (
                                  <button
                                    type="button"
                                    onClick={handleCancelEditNextFireTime}
                                    disabled={isSavingNextFireTime}
                                    className="p-0.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleEditNextFireTime(index, trigger.nextFireTime)}
                                    className="p-0.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit next fire time"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {editingNextFireTime === index ? (
                                <div className="w-full space-y-2">
                                  <input
                                    type="datetime-local"
                                    value={editedNextFireTime ? new Date(editedNextFireTime.getTime() - editedNextFireTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        setEditedNextFireTime(new Date(e.target.value));
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                    disabled={isSavingNextFireTime}
                                  />
                                </div>
                              ) : (
                                <div className="text-xs font-semibold text-blue-700 bg-blue-50 rounded px-2 py-1 border border-blue-200">
                                  {new Date(trigger.nextFireTime).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 italic">
                  <p>No triggers found</p>
                </div>
              )}
            </div>

            {/* Run History Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-900">Run History</h2>
            <button
              type="button"
              onClick={() => {
                const templateNameToUse = template?.name || templateName;
                if (templateNameToUse) {
                  fetchRunHistory(templateNameToUse);
                }
              }}
              disabled={runHistoryLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh run history"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${runHistoryLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          
              {runHistoryLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-600">Loading run history...</p>
                </div>
              ) : runHistoryError ? (
                <div className="py-3 px-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs text-red-600">Error: {runHistoryError}</p>
                </div>
              ) : runHistoryData.length === 0 ? (
                <div className="text-center py-4 text-gray-500 italic">
                  <p className="text-xs">No run history available</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse text-xs table-fixed">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-auto" />
                  <col className="w-40" />
                  <col className="w-40" />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Status
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Message
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Fired At
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Finished At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {runHistoryData.map((historyItem, index) => {
                    const firedAt = historyItem.firedAt ? new Date(historyItem.firedAt).toLocaleString() : "N/A";
                    const finishedAt = historyItem.finishedAt ? new Date(historyItem.finishedAt).toLocaleString() : "N/A";
                    const status = historyItem.status?.toLowerCase() || "unknown";
                    
                    return (
                      <tr key={historyItem.id || index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 py-2 border-r border-gray-200">
                          <span
                            className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full uppercase whitespace-nowrap ${
                              status === "success" || status === "completed"
                                ? "bg-green-100 text-green-800"
                                : status === "error" || status === "failure"
                                ? "bg-red-100 text-red-800"
                                : status === "running"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {historyItem.status || "UNKNOWN"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700 border-r border-gray-200 break-words">
                          {historyItem.message || "N/A"}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap border-r border-gray-200">
                          {firedAt}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {finishedAt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Run Now Modal */}
      {showRunNowModal &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-3">
            <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={() => {
                  setShowRunNowModal(false);
                  setShowStagingForm(false);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {!showStagingForm ? (
                <>
                  {/* Header */}
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 pr-8">Run Campaign</h2>

                  {/* Body */}
                  <p className="text-gray-600 mb-6">
                    Choose how you want to run this campaign:
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleRunNow}
                      disabled={isStartingCampaign}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isStartingCampaign ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Starting Campaign...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run Now
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleStagingClick}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      Staging
                    </button>
                  </div>

                  {/* Cancel Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setShowRunNowModal(false);
                        setShowStagingForm(false);
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Staging Form */}
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 pr-8">Staging Configuration</h2>

                  <div className="space-y-6">
                    {/* Staging Timing */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Staging Timing</label>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="Before First Run Only"
                            checked={stagingTiming === "Before First Run Only"}
                            onChange={(e) => setStagingTiming(e.target.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Before First Run Only</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="Before Each Run"
                            checked={stagingTiming === "Before Each Run"}
                            onChange={(e) => setStagingTiming(e.target.value)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Before Each Run</span>
                        </label>
                      </div>
                    </div>

                    {/* Staging Duration */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Duration</label>
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 whitespace-nowrap">Number</label>
                        <input
                          type="number"
                          min="1"
                          value={stagingDuration}
                          onChange={(e) => setStagingDuration(e.target.value)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Number"
                        />
                        <span className="text-gray-600 font-medium">—</span>
                        <select
                          value={stagingDurationUnit}
                          onChange={(e) => setStagingDurationUnit(e.target.value)}
                          className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Days">Days</option>
                          <option value="Weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setShowStagingForm(false)}
                      className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStagingSubmit}
                      className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    >
                      <Play className="w-4 h-4" />
                      Run with Staging
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SchedulePage;

