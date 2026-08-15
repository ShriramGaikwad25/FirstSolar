"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  Square,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit,
} from "lucide-react";
import { config } from "../../lib/config";
import { apiRequestWithAuth } from "@/lib/auth";
import "./SchedulerManager.css";

interface JobSchedule {
  id: string;
  name: string;
  jobClass: string;
  misfireInstruction: string;
  startDate?: string;
  endDate?: string;
  repeatInterval: number;
  repeatCount: number;
  status: "active" | "paused" | "completed" | "stopped";
  isRunning: boolean;
  currentExecution: number;
  startTime?: Date;
  nextExecutionTime?: Date;
  groupName?: string; // Store the group name from API response
  description?: string; // Job description
  // Trigger fields
  triggerName?: string;
  triggerGroup?: string;
  triggerState?: string;
  type?: string;
  intervalMs?: number;
  previousFireTime?: string;
  nextFireTime?: string;
  cronExpression?: string;
  cronStatement?: string;
}

interface JobLog {
  id: string;
  timestamp: string;
  worker: string;
  message: string;
  status: "success" | "error" | "pending";
}

interface JobProgress {
  currentCount: number;
  totalCount: number;
  percentage: number;
  prevFireTime?: string;
  nextFireTime?: string;
  finalFireTime?: string;
}

const MISFIRE_INSTRUCTIONS = [
  "RESCHEDULE NEXT WITH REMAINING COUNT",
  "RESCHEDULE NEXT WITH EXISTING COUNT",
  "RESCHEDULE NOW WITH REMAINING COUNT",
  "RESCHEDULE NOW WITH EXISTING COUNT",
  "DO NOTHING",
];

// TODO: Replace with API call to fetch available job classes
const DEFAULT_JOB_CLASS = "com.keyforge.quartz.schedular.jobs.SCIMGatewayJob";

const EMPTY_NEW_JOB_DATA = {
  jobClass: "",
  jobName: "",
  jobGroup: "",
  intervalMs: "" as number | "",
  repeatCount: "" as number | "",
  cronExpression: "",
  data: {},
};

export default function SchedulerManager() {
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [selectedSchedule, setSelectedSchedule] = useState<JobSchedule | null>(
    null
  );
  const [schedules, setSchedules] = useState<JobSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false);
  const [jobDetailsError, setJobDetailsError] = useState<string | null>(null);
  const [jobDetailsData, setJobDetailsData] = useState<any>(null);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);
  const [jobHistoryError, setJobHistoryError] = useState<string | null>(null);
  const [jobHistoryData, setJobHistoryData] = useState<any[]>([]);
  const [isJsonDataExpanded, setIsJsonDataExpanded] = useState(false);
  const [editableJsonData, setEditableJsonData] = useState<string>("");
  const [originalJsonData, setOriginalJsonData] = useState<string>("");
  const [isUpdatingJson, setIsUpdatingJson] = useState(false);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [showMiddlePanel, setShowMiddlePanel] = useState(false);
  const [jobSearchTerm, setJobSearchTerm] = useState("");
  const [newJobType, setNewJobType] = useState<"simple" | "cron">("simple");
  const [newJobData, setNewJobData] = useState(EMPTY_NEW_JOB_DATA);

  // Console log form data changes for debugging
  useEffect(() => {
    console.log("Form data updated:", newJobData);
  }, [newJobData]);
  const [jobProgress, setJobProgress] = useState<JobProgress>({
    currentCount: 0,
    totalCount: 10,
    percentage: 0,
    prevFireTime: undefined,
    nextFireTime: undefined,
    finalFireTime: undefined,
  });
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isGlobalRunning, setIsGlobalRunning] = useState(false);

  const showPopup = (message: string, type: "success" | "error" | "info") => {
    setPopup({
      isOpen: true,
      message,
      type,
    });
  };

  useEffect(() => {
    if (!popup.isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPopup((prev) => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [popup.isOpen]);

  // API call to fetch jobs
  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call external scheduler API directly with auth
      const data = await apiRequestWithAuth<string[]>(
        config.api.endpoints.jobs
      );
      console.log("Fetched jobs data:", data);

      // Handle case where API returns an error object
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      // Map API response to our JobSchedule interface
      // Handle the format: ["groupname:jobname"]
      const mappedJobs: JobSchedule[] = data.map((jobString: string) => {
        // Parse the "groupname:jobname" format
        const [groupName, jobName] = jobString.includes(":")
          ? jobString.split(":")
          : ["Default", jobString];

        // Use a stable ID so selection doesn't jump when list changes
        const stableId = `${groupName}:${jobName}`;

        return {
          id: stableId,
          name: jobName || "",
          jobClass: DEFAULT_JOB_CLASS, // Default job class
          misfireInstruction: MISFIRE_INSTRUCTIONS[0], // Default misfire instruction
          startDate: "",
          endDate: "",
          repeatInterval: 5000, // Default 5 seconds
          repeatCount: 10, // Default repeat count
          status: "stopped" as const,
          isRunning: false,
          currentExecution: 0,
          startTime: undefined,
          nextExecutionTime: undefined,
          // Store additional info for reference
          groupName: groupName,
          description: undefined, // Will be populated from job details API
        };
      });

      setSchedules(mappedJobs);

      // Preserve current selection if possible; otherwise select first job
      if (mappedJobs.length > 0) {
        if (selectedSchedule) {
          const match = mappedJobs.find(
            (j) => j.groupName === selectedSchedule.groupName && j.name === selectedSchedule.name
          );
          if (match) {
            setSelectedSchedule(match);
          }
        } else {
          setSelectedSchedule(mappedJobs[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");

      // No fallback data - only use real API data
      setSchedules([]);
      setSelectedSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch job details when a job is selected
  const fetchJobDetails = async (groupName: string, jobName: string) => {
    try {
      setJobDetailsLoading(true);
      setJobDetailsError(null);

      // Call external scheduler API directly with auth
      const data = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/${encodeURIComponent(
          groupName
        )}/${encodeURIComponent(jobName)}`
      );
      console.log("Fetched job details:", data);

      // Before applying, ensure the user is still viewing this job
      const targetId = `${groupName}:${jobName}`;
      if (selectedSchedule && selectedSchedule.id !== targetId) {
        // Selection changed while request was in-flight; ignore
        return;
      }

      // Store the raw API response data
      setJobDetailsData(data);
      // Set the editable JSON data and original data
      const formattedJson = JSON.stringify(data.data || data, null, 2);
      setEditableJsonData(formattedJson);
      setOriginalJsonData(formattedJson);

      // Handle case where API returns an error object
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      // Update the selected schedule with the detailed information
      if (selectedSchedule) {
        const updatedSchedule: JobSchedule = {
          ...selectedSchedule,
          // Map the detailed job data to our interface
          name: data.name || data.jobName || selectedSchedule.name,
          jobClass: data.jobClass || selectedSchedule.jobClass,
          misfireInstruction:
            data.misfireInstruction || selectedSchedule.misfireInstruction,
          startDate: data.startDate || selectedSchedule.startDate,
          endDate: data.endDate || selectedSchedule.endDate,
          repeatInterval:
            data.repeatInterval || selectedSchedule.repeatInterval,
          repeatCount: data.repeatCount || selectedSchedule.repeatCount,
          status: data.status || selectedSchedule.status,
          isRunning: data.isRunning || selectedSchedule.isRunning,
          currentExecution:
            data.currentExecution || selectedSchedule.currentExecution,
          startTime: data.startTime
            ? new Date(data.startTime)
            : selectedSchedule.startTime,
          nextExecutionTime: data.nextExecutionTime
            ? new Date(data.nextExecutionTime)
            : selectedSchedule.nextExecutionTime,
          description:
            data.description ||
            data.jobDescription ||
            selectedSchedule.description,
          // Map trigger fields from API response
          triggerName:
            data.triggerName ||
            data.triggers?.[0]?.triggerName ||
            selectedSchedule.triggerName,
          triggerGroup:
            data.triggerGroup ||
            data.triggers?.[0]?.triggerGroup ||
            selectedSchedule.triggerGroup,
          triggerState:
            data.triggerState ||
            data.triggers?.[0]?.triggerState ||
            selectedSchedule.triggerState,
          type: data.type || data.triggers?.[0]?.type || selectedSchedule.type,
          intervalMs:
            data.intervalMs ||
            data.triggers?.[0]?.intervalMs ||
            selectedSchedule.intervalMs,
          previousFireTime:
            data.previousFireTime ||
            data.triggers?.[0]?.previousFireTime ||
            selectedSchedule.previousFireTime,
          nextFireTime:
            data.nextFireTime ||
            data.triggers?.[0]?.nextFireTime ||
            selectedSchedule.nextFireTime,
          cronExpression:
            data.cronExpression ||
            data.triggers?.[0]?.cronExpression ||
            selectedSchedule.cronExpression,
          cronStatement:
            data.cronStatement ||
            data.triggers?.[0]?.cronStatement ||
            selectedSchedule.cronStatement,
        };

        // Only apply if still the selected job
        if (selectedSchedule.id === targetId) {
          setSelectedSchedule(updatedSchedule);
        }

        // Update the schedules array with the updated job
        setSchedules((prev) =>
          prev.map((schedule) =>
            schedule.id === selectedSchedule.id ? updatedSchedule : schedule
          )
        );
      }
    } catch (err) {
      console.error("Error fetching job details:", err);
      setJobDetailsError(
        err instanceof Error ? err.message : "Failed to fetch job details"
      );
    } finally {
      setJobDetailsLoading(false);
    }
  };

  // Fetch job history
  const fetchJobHistory = async (groupName: string, jobName: string) => {
    try {
      setJobHistoryLoading(true);
      setJobHistoryError(null);

      // Call external scheduler history API directly with auth
      const data = await apiRequestWithAuth<any[]>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/history/${encodeURIComponent(
          groupName
        )}/${encodeURIComponent(jobName)}`
      );

      // Ensure still viewing this job
      const targetId = `${groupName}:${jobName}`;
      if (selectedSchedule && selectedSchedule.id !== targetId) {
        return;
      }

      // Check if the response contains an error
      if (data && typeof data === "object" && (data.message || data.error)) {
        throw new Error(data.message || data.error);
      }

      // Set the history data (should be an array)
      setJobHistoryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching job history:", err);
      setJobHistoryError(
        err instanceof Error ? err.message : "Failed to fetch job history"
      );
      setJobHistoryData([]);
    } finally {
      setJobHistoryLoading(false);
    }
  };

  // Refresh current job details and history
  const refreshSelectedJobData = () => {
    if (
      selectedSchedule &&
      selectedSchedule.groupName &&
      selectedSchedule.name
    ) {
      fetchJobDetails(selectedSchedule.groupName, selectedSchedule.name);
      fetchJobHistory(selectedSchedule.groupName, selectedSchedule.name);
    }
  };

  // Resume job
  const resumeJob = async (groupName: string, jobName: string) => {
    try {
      setIsUpdatingJson(true);

      const resumeResult = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/${encodeURIComponent(
          groupName
        )}/${encodeURIComponent(jobName)}/resume`,
        { method: "POST" }
      );
      console.log("Job resumed successfully:", resumeResult);

      showPopup("Job resumed successfully!", "success");
      refreshSelectedJobData();
    } catch (error) {
      console.error("Error resuming job:", error);
      showPopup(
        `Failed to resume job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsUpdatingJson(false);
    }
  };

  // Pause job
  const pauseJob = async (groupName: string, jobName: string) => {
    try {
      setIsUpdatingJson(true);

      const pauseResult = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/${encodeURIComponent(
          groupName
        )}/${encodeURIComponent(jobName)}/pause`,
        { method: "POST" }
      );
      console.log("Job paused successfully:", pauseResult);

      showPopup("Job paused successfully!", "success");
      refreshSelectedJobData();
    } catch (error) {
      console.error("Error pausing job:", error);
      showPopup(
        `Failed to pause job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsUpdatingJson(false);
    }
  };

  // Trigger job manually
  const triggerJobManually = async (groupName: string, jobName: string) => {
    try {
      setIsUpdatingJson(true); // Reuse loading state for now

      const triggerResult = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/${encodeURIComponent(
          groupName
        )}/${encodeURIComponent(jobName)}/trigger`,
        { method: "POST" }
      );
      console.log("Job triggered successfully:", triggerResult);

      // Show success message
      showPopup("Job triggered successfully!", "success");
      refreshSelectedJobData();
    } catch (error) {
      console.error("Error triggering job:", error);
      showPopup(
        `Failed to trigger job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsUpdatingJson(false);
    }
  };

  // Update JSON data
  const updateJsonData = async () => {
    if (!selectedSchedule || !selectedSchedule.groupName) {
      return;
    }

    try {
      setIsUpdatingJson(true);

      // Parse the edited JSON to validate it
      let parsedData;
      try {
        parsedData = JSON.parse(editableJsonData);
      } catch (parseError) {
        showPopup("Invalid JSON format. Please check your syntax.", "error");
        return;
      }

      // Make API call to update the job data directly on external scheduler
      const updatedData = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/kfscheduler/api/v1/ACMECOM/jobs/${encodeURIComponent(
          selectedSchedule.groupName
        )}/${encodeURIComponent(selectedSchedule.name)}`,
        {
          method: "PUT",
          body: JSON.stringify(parsedData),
        }
      );
      console.log("Job data updated successfully:", updatedData);

      // Update the local state with the response
      setJobDetailsData(updatedData);

      // Update the original data to match the new data
      setOriginalJsonData(editableJsonData);

      // Show success message
      showPopup("JSON data updated successfully!", "success");
    } catch (error) {
      console.error("Error updating JSON data:", error);
      showPopup(
        `Failed to update JSON data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsUpdatingJson(false);
    }
  };

  // Check if JSON data has been modified
  const isJsonDataModified = editableJsonData !== originalJsonData;

  // Create new job
  const createNewJob = async () => {
    try {
      setIsUpdatingJson(true);

      const payload = {
        jobClass: newJobData.jobClass,
        jobName: newJobData.jobName,
        jobGroup: newJobData.jobGroup,
        data: newJobData.data,
        ...(newJobType === "simple"
          ? {
              intervalMs: Number(newJobData.intervalMs),
              repeatCount: Number(newJobData.repeatCount),
            }
          : { cronExpression: newJobData.cronExpression }),
      };

      // Console log the created data
      console.log("=== JOB CREATION DATA ===");
      console.log("Job Type:", newJobType);
      console.log("Form Data:", newJobData);
      console.log("Payload being sent to API:", payload);
      console.log("Payload JSON:", JSON.stringify(payload, null, 2));

      const createEndpoint =
        newJobType === "simple"
          ? `${config.api.endpoints.jobs}/schedule/interval`
          : `${config.api.endpoints.jobs}/schedule/cron`;

      const createResult = await apiRequestWithAuth<any>(createEndpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log("=== JOB CREATED SUCCESSFULLY ===");
      console.log("Response:", createResult);

      showPopup("Job created successfully!", "success");
      setShowNewJobForm(false);
      setShowMiddlePanel(false);
      // Reset form
      setNewJobData(EMPTY_NEW_JOB_DATA);
      setNewJobType("simple");
      // Refresh job list
      fetchJobs();
    } catch (error) {
      console.log("=== JOB CREATION ERROR ===");
      console.error("Error creating job:", error);
      console.log("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      });
      showPopup(
        `Failed to create job: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsUpdatingJson(false);
    }
  };

  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);

  // Fetch jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
    }
  }, [schedules, selectedSchedule]);

  // Fetch job details when selectedSchedule changes
  useEffect(() => {
    if (
      selectedSchedule &&
      selectedSchedule.groupName &&
      selectedSchedule.name
    ) {
      fetchJobDetails(selectedSchedule.groupName, selectedSchedule.name);
      fetchJobHistory(selectedSchedule.groupName, selectedSchedule.name);
    } else {
      // Reset JSON data when no job is selected
      setEditableJsonData("");
      setOriginalJsonData("");
      setJobDetailsData(null);
    }
  }, [selectedSchedule?.id]); // Only fetch when the job ID changes

  // Close date pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        startDatePickerRef.current &&
        !startDatePickerRef.current.contains(event.target as Node)
      ) {
        setShowStartDatePicker(false);
      }
      if (
        endDatePickerRef.current &&
        !endDatePickerRef.current.contains(event.target as Node)
      ) {
        setShowEndDatePicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update progress when selected schedule changes
  useEffect(() => {
    if (selectedSchedule) {
      setJobProgress({
        currentCount: selectedSchedule.currentExecution,
        totalCount: selectedSchedule.repeatCount,
        percentage: Math.round(
          (selectedSchedule.currentExecution / selectedSchedule.repeatCount) *
            100
        ),
        prevFireTime:
          selectedSchedule.currentExecution > 0
            ? new Date(
                Date.now() - selectedSchedule.repeatInterval
              ).toLocaleString()
            : undefined,
        nextFireTime:
          selectedSchedule.isRunning &&
          selectedSchedule.currentExecution < selectedSchedule.repeatCount
            ? new Date(
                Date.now() + selectedSchedule.repeatInterval
              ).toLocaleString()
            : undefined,
        finalFireTime:
          selectedSchedule.repeatCount > 0
            ? new Date(
                Date.now() +
                  (selectedSchedule.repeatCount -
                    selectedSchedule.currentExecution) *
                    selectedSchedule.repeatInterval
              ).toLocaleString()
            : undefined,
      });
    }
  }, [selectedSchedule]);

  // Main scheduling logic
  useEffect(() => {
    if (isGlobalRunning && selectedSchedule && selectedSchedule.isRunning) {
      intervalRef.current = setInterval(() => {
        setSchedules((prev) =>
          prev.map((schedule) => {
            if (schedule.id === selectedSchedule.id && schedule.isRunning) {
              const newExecution = schedule.currentExecution + 1;
              const isCompleted = newExecution >= schedule.repeatCount;

              // Add log entry
              const newLog: JobLog = {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleString(),
                worker: `example_Worker-${Math.floor(Math.random() * 5) + 1}`,
                message: generateJobMessage(schedule.jobClass, isCompleted),
                status:
                  Math.random() > 0.1
                    ? "success"
                    : Math.random() > 0.5
                    ? "error"
                    : "pending",
              };

              setJobLogs((prev) => [newLog, ...prev.slice(0, 19)]); // Keep last 20 logs

              return {
                ...schedule,
                currentExecution: newExecution,
                status: isCompleted ? "completed" : "active",
                isRunning: !isCompleted,
                nextExecutionTime: !isCompleted
                  ? new Date(Date.now() + schedule.repeatInterval)
                  : undefined,
              };
            }
            return schedule;
          })
        );
      }, selectedSchedule.repeatInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isGlobalRunning, selectedSchedule]);

  const generateJobMessage = (
    jobClass: string,
    isCompleted: boolean
  ): string => {
    const type = jobClass.split(".").pop()?.replace("Job", "") || "Simple";
    const messages = {
      Simple: [
        "Hello World!",
        "Simple job executed",
        "Task completed successfully",
      ],
      Complex: [
        "Complex processing started",
        "Complex job in progress",
        "Complex task completed",
      ],
      Email: [
        "Email sent successfully",
        "Email job processed",
        "Email notification sent",
      ],
      Report: [
        "Report generated",
        "Report job completed",
        "Report processing finished",
      ],
    };

    const typeMessages =
      messages[type as keyof typeof messages] || messages.Simple;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  };

  const validateDateRange = (startDate: string, endDate: string): boolean => {
    if (!startDate || !endDate) return true;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return start < end;
    } catch {
      return false;
    }
  };

  // Date picker helper functions
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handleDateSelect = (date: Date, isStartDate: boolean) => {
    const time = isStartDate
      ? selectedSchedule?.startDate
        ? new Date(selectedSchedule.startDate).toTimeString().slice(0, 5)
        : "12:00"
      : selectedSchedule?.endDate
      ? new Date(selectedSchedule.endDate).toTimeString().slice(0, 5)
      : "12:00";

    const newDateTime = new Date(
      `${date.toISOString().split("T")[0]}T${time}`
    ).toLocaleString();

    if (isStartDate) {
      if (validateDateRange(newDateTime, selectedSchedule?.endDate || "")) {
        setSelectedSchedule({
          ...selectedSchedule!,
          startDate: newDateTime,
        });
        setShowStartDatePicker(false);
      } else {
        showPopup("Start date must be before end date", "error");
      }
    } else {
      if (validateDateRange(selectedSchedule?.startDate || "", newDateTime)) {
        setSelectedSchedule({
          ...selectedSchedule!,
          endDate: newDateTime,
        });
        setShowEndDatePicker(false);
      } else {
        showPopup("End date must be after start date", "error");
      }
    }
  };

  const handleTimeChange = (time: string, isStartDate: boolean) => {
    const date = isStartDate
      ? selectedSchedule?.startDate
        ? new Date(selectedSchedule.startDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
      : selectedSchedule?.endDate
      ? new Date(selectedSchedule.endDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const newDateTime = new Date(`${date}T${time}`).toLocaleString();

    if (isStartDate) {
      if (validateDateRange(newDateTime, selectedSchedule?.endDate || "")) {
        setSelectedSchedule({
          ...selectedSchedule!,
          startDate: newDateTime,
        });
      } else {
        showPopup("Start date must be before end date", "error");
      }
    } else {
      if (validateDateRange(selectedSchedule?.startDate || "", newDateTime)) {
        setSelectedSchedule({
          ...selectedSchedule!,
          endDate: newDateTime,
        });
      } else {
        showPopup("End date must be after start date", "error");
      }
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSchedule) {
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === selectedSchedule.id ? selectedSchedule : schedule
        )
      );
    }
  };

  const handleCreateNewSchedule = () => {
    const newSchedule: JobSchedule = {
      id: Date.now().toString(),
      name: "New Job Task",
      jobClass: DEFAULT_JOB_CLASS,
      misfireInstruction: MISFIRE_INSTRUCTIONS[0],
      startDate: "",
      endDate: "",
      repeatInterval: 5000,
      repeatCount: 10,
      status: "stopped",
      isRunning: false,
      currentExecution: 0,
      startTime: undefined,
      nextExecutionTime: undefined,
    };
    setSchedules((prev) => [...prev, newSchedule]);
    setSelectedSchedule(newSchedule);
  };

  const handleStartCampaign = () => {
    console.log("Start button clicked!");
    if (selectedSchedule) {
      console.log("Selected schedule:", selectedSchedule);
      let startTime: Date;

      if (selectedSchedule.startDate) {
        startTime = new Date(selectedSchedule.startDate);
        console.log(
          "Using configured start date:",
          selectedSchedule.startDate,
          "Parsed as:",
          startTime
        );
      } else {
        startTime = new Date();
        console.log("No start date configured, using current time:", startTime);
      }

      const now = new Date();

      // If start date is in the future, don't start immediately
      if (startTime > now) {
        showPopup(
          `Campaign will start at ${startTime.toLocaleString()}`,
          "info"
        );
        return;
      }

      console.log("Starting campaign with start time:", startTime);

      const updatedSchedule = {
        ...selectedSchedule,
        status: "active" as const,
        isRunning: true,
        startTime: startTime,
        nextExecutionTime: new Date(
          Date.now() + selectedSchedule.repeatInterval
        ),
      };

      console.log("Updated schedule:", updatedSchedule);

      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === selectedSchedule.id ? updatedSchedule : schedule
        )
      );
      setSelectedSchedule(updatedSchedule);
      setIsGlobalRunning(true);

      console.log("Campaign started successfully!");
    } else {
      console.log("No selected schedule!");
    }
  };

  const handlePauseCampaign = () => {
    console.log("Pause button clicked!");
    if (selectedSchedule) {
      const updatedSchedule = {
        ...selectedSchedule,
        status: "paused" as const,
        isRunning: false,
      };

      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === selectedSchedule.id ? updatedSchedule : schedule
        )
      );
      setSelectedSchedule(updatedSchedule);
      setIsGlobalRunning(false);
      console.log("Campaign paused successfully!");
    }
  };

  const handleStopCampaign = () => {
    console.log("Stop button clicked!");
    if (selectedSchedule) {
      const updatedSchedule = {
        ...selectedSchedule,
        status: "stopped" as const,
        isRunning: false,
        currentExecution: 0,
        startTime: undefined,
        nextExecutionTime: undefined,
      };

      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === selectedSchedule.id ? updatedSchedule : schedule
        )
      );
      setSelectedSchedule(updatedSchedule);
      setIsGlobalRunning(false);
      setJobLogs([]);
      console.log("Job stopped successfully!");
    }
  };

  const handleResetCampaign = () => {
    console.log("Reset button clicked!");
    if (selectedSchedule) {
      const updatedSchedule = {
        ...selectedSchedule,
        status: "stopped" as const,
        isRunning: false,
        currentExecution: 0,
        startTime: undefined,
        nextExecutionTime: undefined,
      };

      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === selectedSchedule.id ? updatedSchedule : schedule
        )
      );
      setSelectedSchedule(updatedSchedule);
      setIsGlobalRunning(false);
      setJobLogs([]);
      console.log("Job reset successfully!");
    }
  };

  const formatIntervalHours = (intervalMs?: number): string => {
    if (typeof intervalMs !== "number" || Number.isNaN(intervalMs)) {
      return "N/A";
    }

    const hours = intervalMs / (1000 * 60 * 60);
    // Keep whole hours clean, otherwise show up to 2 decimals
    return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(2)}`;
  };

  const filteredSchedules = schedules.filter((schedule) => {
    const term = jobSearchTerm.trim().toLowerCase();
    if (!term) return true;

    return (
      schedule.name.toLowerCase().includes(term) ||
      (schedule.groupName || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="scheduler-manager">
      {popup.isOpen && (
        <div
          className="scheduler-modal-overlay"
          onClick={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="scheduler-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Scheduler notification"
          >
            <div className={`scheduler-modal-badge scheduler-modal-${popup.type}`}>
              {popup.type.toUpperCase()}
            </div>
            <p className="scheduler-modal-message">{popup.message}</p>
            <div className="scheduler-modal-actions">
              <button
                className="scheduler-modal-btn"
                onClick={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="scheduler-header">
        {selectedSchedule ? (
          <div className="job-header">
            <div className="job-title">
              <div className="job-title-row">
                <h1>{selectedSchedule.name}</h1>
                <button
                  className="edit-job-btn"
                  onClick={() => {
                    setShowMiddlePanel(true);
                    setIsJsonDataExpanded(false);
                    // Fetch job details if not already loaded
                    if (selectedSchedule.groupName && selectedSchedule.name) {
                      fetchJobDetails(selectedSchedule.groupName, selectedSchedule.name);
                    }
                  }}
                  title="Edit Job"
                >
                  <Edit className="edit-icon" />
                </button>
              </div>
            </div>
            <div className="job-controls">
              <button
                className={`control-btn start-btn ${
                  selectedSchedule.isRunning ? "active" : ""
                }`}
                onClick={() =>
                  triggerJobManually(
                    selectedSchedule.groupName || "",
                    selectedSchedule.name
                  )
                }
                disabled={isUpdatingJson}
              >
                {isUpdatingJson ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="btn-icon" />
                    Run
                  </>
                )}
              </button>
              {(() => {
                const state = (
                  selectedSchedule.triggerState || ""
                ).toUpperCase();
                const isPaused = state === "PAUSED";
                return isPaused;
              })() ? (
                <button
                  className="control-btn resume-btn"
                  onClick={() =>
                    resumeJob(
                      selectedSchedule.groupName || "",
                      selectedSchedule.name
                    )
                  }
                  disabled={isUpdatingJson}
                >
                  {isUpdatingJson ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Play className="btn-icon" />
                      Resume
                    </>
                  )}
                </button>
              ) : (
                <button
                  className="control-btn pause-btn"
                  onClick={() =>
                    pauseJob(
                      selectedSchedule.groupName || "",
                      selectedSchedule.name
                    )
                  }
                  disabled={isUpdatingJson}
                >
                  {isUpdatingJson ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Pausing...
                    </>
                  ) : (
                    <>
                      <Pause className="btn-icon" />
                      Pause
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="no-job-selected-header">
            <h1>Select a Job</h1>
            <p>Choose a job from the left panel to view details and controls</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="scheduler-content">
        {/* Left Panel - Jobs List Only */}
        <div className="triggers-panel">
          <div className="triggers-header">
            <h3>JOBS</h3>
            <button
              className="new-trigger-btn"
              onClick={() => {
                if (!showNewJobForm) {
                  setNewJobData(EMPTY_NEW_JOB_DATA);
                  setNewJobType("simple");
                  setShowMiddlePanel(true);
                  setShowNewJobForm(true);
                } else {
                  setShowNewJobForm(false);
                }
              }}
              disabled={loading}
            >
              {showNewJobForm ? "Cancel" : "New"}
            </button>
          </div>
          <div className="job-search-wrapper">
            <input
              type="text"
              className="job-search-input"
              placeholder="Search jobs..."
              value={jobSearchTerm}
              onChange={(e) => setJobSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading jobs...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-message">Error: {error}</p>
              <button className="retry-btn" onClick={fetchJobs}>
                Retry
              </button>
            </div>
          ) : (
            <div className="trigger-list">
              {schedules.length === 0 ? (
                <div className="no-jobs">
                  <p>No jobs found</p>
                  <button
                    className="create-first-job-btn"
                    onClick={handleCreateNewSchedule}
                  >
                    Create First Job
                  </button>
                </div>
              ) : filteredSchedules.length === 0 ? (
                <div className="no-jobs">
                  <p>No jobs match your search</p>
                </div>
              ) : (
                filteredSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`trigger-item ${
                      selectedSchedule?.id === schedule.id ? "selected" : ""
                    } ${schedule.status}`}
                    onClick={() => {
                      // Only set selection; data fetching is driven by effect below
                      setSelectedSchedule(schedule);
                    }}
                  >
                    <div className="trigger-name">{schedule.name}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Middle Panel - Job Details */}
        {showMiddlePanel && (
          <div className="details-panel">
            <div className="details-panel-header">
              <h3>JOB DETAILS</h3>
              <button
                className="close-panel-btn"
                onClick={() => {
                  setShowMiddlePanel(false);
                  setShowNewJobForm(false);
                }}
                title="Close Panel"
              >
                ×
              </button>
            </div>
            {showNewJobForm ? (
            <div className="new-job-form">
              <h3>CREATE NEW JOB</h3>

              {/* Basic Job Info */}
              <div className="form-group">
                <label>Job Name:</label>
                <input
                  type="text"
                  value={newJobData.jobName}
                  onChange={(e) =>
                    setNewJobData({ ...newJobData, jobName: e.target.value })
                  }
                  placeholder="Enter job name"
                />
              </div>

              <div className="form-group">
                <label>Job Group:</label>
                <input
                  type="text"
                  value={newJobData.jobGroup}
                  onChange={(e) =>
                    setNewJobData({ ...newJobData, jobGroup: e.target.value })
                  }
                  placeholder="Enter job group"
                />
              </div>

              <div className="form-group">
                <label>Job Class:</label>
                <input
                  type="text"
                  value={newJobData.jobClass}
                  onChange={(e) =>
                    setNewJobData({ ...newJobData, jobClass: e.target.value })
                  }
                  placeholder="Enter job class"
                />
              </div>

              {/* Job Type Selection */}
              <div className="form-group">
                <label>Job Type:</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="jobType"
                      value="simple"
                      checked={newJobType === "simple"}
                      onChange={(e) =>
                        setNewJobType(e.target.value as "simple" | "cron")
                      }
                    />
                    Simple Job
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="jobType"
                      value="cron"
                      checked={newJobType === "cron"}
                      onChange={(e) =>
                        setNewJobType(e.target.value as "simple" | "cron")
                      }
                    />
                    Cron Job
                  </label>
                </div>
              </div>

              {/* Simple Job Fields */}
              {newJobType === "simple" && (
                <>
                  <div className="form-group">
                    <label>Interval (ms):</label>
                    <input
                      type="number"
                      value={newJobData.intervalMs}
                      onChange={(e) =>
                        setNewJobData({
                          ...newJobData,
                          intervalMs:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      placeholder="86400000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Repeat Count:</label>
                    <input
                      type="number"
                      value={newJobData.repeatCount}
                      onChange={(e) =>
                        setNewJobData({
                          ...newJobData,
                          repeatCount:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value, 10),
                        })
                      }
                      placeholder="1"
                    />
                  </div>
                </>
              )}

              {/* Cron Job Fields */}
              {newJobType === "cron" && (
                <div className="form-group">
                  <label>Cron Expression:</label>
                  <input
                    type="text"
                    value={newJobData.cronExpression}
                    onChange={(e) =>
                      setNewJobData({
                        ...newJobData,
                        cronExpression: e.target.value,
                      })
                    }
                    placeholder="0 0/10 * * * ?"
                  />
                </div>
              )}

              {/* Data Configuration */}
              <div className="form-group">
                <label>Data (JSON):</label>
                <textarea
                  className="json-data-input"
                  value={
                    Object.keys(newJobData.data).length === 0
                      ? ""
                      : JSON.stringify(newJobData.data, null, 2)
                  }
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value === "") {
                      setNewJobData({
                        ...newJobData,
                        data: {},
                      });
                    } else {
                      try {
                        const parsedData = JSON.parse(value);
                        setNewJobData({
                          ...newJobData,
                          data: parsedData,
                        });
                      } catch (error) {
                        // Keep the text as is if JSON is invalid
                        // The user can continue typing
                      }
                    }
                  }}
                  rows={8}
                  spellCheck={false}
                />
              </div>

              <div className="form-actions">
                <button
                  className="create-job-btn"
                  onClick={createNewJob}
                  disabled={
                    isUpdatingJson ||
                    !newJobData.jobName ||
                    !newJobData.jobGroup ||
                    !newJobData.jobClass ||
                    (newJobType === "simple" &&
                      (newJobData.intervalMs === "" ||
                        newJobData.repeatCount === "")) ||
                    (newJobType === "cron" && !newJobData.cronExpression)
                  }
                >
                  {isUpdatingJson ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Creating...
                    </>
                  ) : (
                    "Create Job"
                  )}
                </button>
              </div>
            </div>
          ) : selectedSchedule ? (
            <div className="trigger-details">

              {jobDetailsLoading && (
                <div className="job-details-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading job details...</p>
                </div>
              )}

              {jobDetailsError && (
                <div className="job-details-error">
                  <p className="error-message">Error: {jobDetailsError}</p>
                  <button
                    className="retry-btn"
                    onClick={() => {
                      if (selectedSchedule.groupName) {
                        fetchJobDetails(
                          selectedSchedule.groupName,
                          selectedSchedule.name
                        );
                      }
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!jobDetailsLoading && !jobDetailsError && (
                <div className="job-info-display">
                  <div className="job-info-item">
                    <span className="info-label">Job Name:</span>
                    <span className="info-value">{selectedSchedule.name}</span>
                  </div>
                  <div className="job-info-item">
                    <span className="info-label">Job Group:</span>
                    <span className="info-value">
                      {selectedSchedule.groupName || "N/A"}
                    </span>
                  </div>
                  <div className="job-info-item">
                    <span className="info-label">Job Class:</span>
                    <span className="info-value">
                      {selectedSchedule.jobClass}
                    </span>
                  </div>
                  <div className="job-info-item">
                    <span className="info-label">Description:</span>
                    <span className="info-value">
                      {selectedSchedule.description ||
                        "No description available"}
                    </span>
                  </div>
                </div>
              )}

              {/* JSON Data Display */}
              {!jobDetailsLoading && !jobDetailsError && (
                <div className="json-data-display">
                  <div
                    className="json-data-header"
                    onClick={() => setIsJsonDataExpanded(!isJsonDataExpanded)}
                  >
                    <h4>JSON Data</h4>
                    {isJsonDataExpanded ? (
                      <ChevronDown className="json-toggle-icon" />
                    ) : (
                      <ChevronRight className="json-toggle-icon" />
                    )}
                  </div>
                  {isJsonDataExpanded && (
                    <div className="json-container">
                      {!selectedSchedule ? (
                        <div className="no-job-selected-message">
                          <p>
                            Please select a job to view and edit its JSON data.
                          </p>
                        </div>
                      ) : (
                        <>
                          <textarea
                            className="json-content"
                            value={editableJsonData}
                            onChange={(e) =>
                              setEditableJsonData(e.target.value)
                            }
                            rows={10}
                            spellCheck={false}
                            placeholder="Enter JSON data here..."
                          />
                          <div className="json-actions">
                            <button
                              className="update-json-btn"
                              onClick={updateJsonData}
                              disabled={isUpdatingJson || !isJsonDataModified}
                            >
                              {isUpdatingJson ? (
                                <>
                                  <div className="loading-spinner-small"></div>
                                  Updating...
                                </>
                              ) : (
                                "Update"
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="no-job-selected">
              <p>Select a job to view details or click "New" to create a job</p>
            </div>
          )}
          </div>
        )}

        {/* Right Panel - Triggers */}
        {!showNewJobForm && (
          <div className={`job-panel ${!showMiddlePanel ? 'job-panel-full' : ''}`}>
            <div className="jobs-section">
              <h3>TRIGGERS</h3>

              {/* Single Trigger Card */}
              <div className="trigger-card-section">
                {selectedSchedule ? (
                  <div className="trigger-card">
                    <div className="trigger-card-header">
                      <h4>Trigger: {selectedSchedule.triggerName || "N/A"}</h4>
                    </div>

                    <div className="trigger-card-content">
                      <div className="trigger-info-rows">
                        <div className="trigger-info-row">
                          <div className="info-item">
                            <span className="info-label">Trigger Group:</span>
                            <span className="info-value">
                              {selectedSchedule.triggerGroup || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Trigger State:</span>
                            <span
                              className={`info-value status-${selectedSchedule.triggerState?.toLowerCase()}`}
                            >
                              {selectedSchedule.triggerState || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Type:</span>
                            <span className="info-value">
                              {selectedSchedule.type || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Interval (hours):</span>
                            <span className="info-value">
                              {formatIntervalHours(selectedSchedule.intervalMs)}
                            </span>
                          </div>
                        </div>
                        <div className="trigger-info-row">
                          <div className="info-item">
                            <span className="info-label">Repeat Count:</span>
                            <span className="info-value">
                              {selectedSchedule.repeatCount || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">
                              Previous Fire Time:
                            </span>
                            <span className="info-value">
                              {selectedSchedule.previousFireTime || "N/A"}
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Next Fire Time:</span>
                            <span className="info-value">
                              {selectedSchedule.nextFireTime || "N/A"}
                            </span>
                          </div>
                          {(selectedSchedule.type || "")
                            .toUpperCase()
                            .includes("CRON") && (
                            <>
                              <div className="info-item">
                                <span className="info-label">
                                  Cron Expression:
                                </span>
                                <span className="info-value">
                                  {selectedSchedule.cronExpression || "N/A"}
                                </span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">
                                  Cron Statement:
                                </span>
                                <span className="info-value">
                                  {selectedSchedule.cronStatement || "N/A"}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-trigger-selected">
                    <p>Select a job to view its trigger details</p>
                  </div>
                )}
              </div>
            </div>

            {/* Job History Section */}
            <div className="history-section">
              <h3>JOB HISTORY</h3>

              {jobHistoryLoading ? (
                <div className="history-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading job history...</p>
                </div>
              ) : jobHistoryError ? (
                <div className="history-error">
                  <p>Error: {jobHistoryError}</p>
                </div>
              ) : jobHistoryData.length === 0 ? (
                <div className="no-history">
                  <p>No job history available</p>
                </div>
              ) : (
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Fired At</th>
                        <th>Status</th>
                        <th>Job Name</th>
                        <th>Job Group</th>
                        <th>Trigger Name</th>
                        <th>Trigger Group</th>
                        <th>Finished At</th>
                        <th>Duration</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobHistoryData.map((historyItem, index) => (
                        <tr key={historyItem.id || index} className="history-row">
                          <td className="history-timestamp">
                            {historyItem.firedAt
                              ? new Date(historyItem.firedAt).toLocaleString()
                              : "N/A"}
                          </td>
                          <td>
                            <span
                              className={`history-status status-${
                                historyItem.status?.toLowerCase() || "unknown"
                              }`}
                            >
                              {historyItem.status || "UNKNOWN"}
                            </span>
                          </td>
                          <td className="history-job-name">
                            {historyItem.jobName || "N/A"}
                          </td>
                          <td className="history-job-group">
                            {historyItem.jobGroup || "N/A"}
                          </td>
                          <td className="history-trigger-name">
                            {historyItem.triggerName || "N/A"}
                          </td>
                          <td className="history-trigger-group">
                            {historyItem.triggerGroup || "N/A"}
                          </td>
                          <td className="history-finished">
                            {historyItem.finishedAt
                              ? new Date(historyItem.finishedAt).toLocaleString()
                              : "N/A"}
                          </td>
                          <td className="history-duration">
                            {historyItem.firedAt && historyItem.finishedAt
                              ? `${new Date(historyItem.finishedAt).getTime() -
                                  new Date(historyItem.firedAt).getTime()}ms`
                              : "N/A"}
                          </td>
                          <td className="history-message">
                            {historyItem.message || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
