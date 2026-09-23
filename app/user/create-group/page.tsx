"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Upload } from "lucide-react";
import { executeQuery } from "@/lib/api";
import { useForm, Control, FieldValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import ExpressionBuilder from "@/components/ExpressionBuilder";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";

interface User {
  name: string;
  email: string;
  title?: string;
  department?: string;
}

interface FormData {
  step1: {
    groupName: string;
    description: string;
    owner: string;
    tags: string;
    ownerIsReviewer: boolean;
  };
  step2: {
    selectionMethod: "specific" | "selectEach" | "upload";
    specificUserExpression: { attribute: any; operator: any; value: string; logicalOp: string; id: string }[];
    selectedUsers: string[];
    uploadedFile: File | null;
  };
}

export default function CreateUserGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const [currentStep, setCurrentStep] = useState(1);
  const [validationStatus, setValidationStatus] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    step1: {
      groupName: "",
      description: "",
      owner: "",
      tags: "",
      ownerIsReviewer: false,
    },
    step2: {
      selectionMethod: "specific",
      specificUserExpression: [],
      selectedUsers: [],
      uploadedFile: null,
    },
  });

  const steps = [
    { id: 1, title: "Group Details" },
    { id: 2, title: "Select Users" },
    { id: 3, title: "Review & Submit" },
  ];

  // Prefill Group Details when arriving in edit mode from the Modify action
  // on the User Groups table (which stores the selected row before navigating here).
  useEffect(() => {
    if (!isEditMode) return;
    try {
      const stored = localStorage.getItem("selectedUserGroup");
      if (!stored) return;
      const group = JSON.parse(stored);
      setFormData((prev) => ({
        ...prev,
        step1: {
          ...prev.step1,
          groupName: group.userGroup ?? group.groupName ?? "",
          description: group.description ?? "",
          owner: group.owner ?? "",
          tags: group.tags ?? "",
        },
      }));
    } catch (err) {
      console.error("Error loading group for edit:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const query = "SELECT * FROM usr WHERE lower(department) = ?";
        const parameters = ["operations"];
        
        const response = await executeQuery(query, parameters);
        
        let userList: User[] = [];
        
        if (response && typeof response === 'object' && 'resultSet' in response && Array.isArray((response as any).resultSet)) {
          const sourceArray: any[] = (response as any).resultSet;
          userList = sourceArray.map((user: any) => ({
            name: user.displayname || user.displayName || user.firstname + " " + user.lastname || "Unknown",
            email: user.email?.work || user.customattributes?.emails?.[0]?.value || user.username || "Unknown",
            title: user.title || user.customattributes?.title || "",
            department: user.department || user.customattributes?.enterpriseUser?.department || "",
          }));
        } else if (response && Array.isArray(response)) {
          userList = response.map((user: any) => ({
            name: user.displayname || user.displayName || user.firstname + " " + user.lastname || "Unknown",
            email: user.email?.work || user.customattributes?.emails?.[0]?.value || user.username || "Unknown",
            title: user.title || user.customattributes?.title || "",
            department: user.department || user.customattributes?.enterpriseUser?.department || "",
          }));
        }
        
        // Fallback to default users if API response is empty
        if (userList.length === 0) {
          userList = [
            {
              name: "Aamod Radwan",
              email: "aamod.radwan@zillasecurity.io",
              title: "Staff",
              department: "Sales",
            },
            {
              name: "Abdulah Thibadeau",
              email: "abdulah.thibadeau@zillasecurity.io",
              title: "Manager - IT & Security",
              department: "IT & Security",
            },
          ];
        }
        
        setUsers(userList);
      } catch (err) {
        console.error("Error fetching users:", err);
        // Fallback to default users on error
        setUsers([
          {
            name: "Aamod Radwan",
            email: "aamod.radwan@zillasecurity.io",
            title: "Staff",
            department: "Sales",
          },
          {
            name: "Abdulah Thibadeau",
            email: "abdulah.thibadeau@zillasecurity.io",
            title: "Manager - IT & Security",
            department: "IT & Security",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Validate Step 1
  useEffect(() => {
    const isValid =
      formData.step1.groupName.trim() !== "" &&
      formData.step1.description.trim() !== "" &&
      formData.step1.owner.trim() !== "";
    setValidationStatus((prev) => {
      const newStatus = [...prev];
      newStatus[0] = isValid;
      return newStatus;
    });
  }, [formData.step1]);

  // React Hook Form for Step 2
  const step2Form = useForm<FieldValues>({
    mode: "onChange",
    defaultValues: {
      specificUserExpression: formData.step2.specificUserExpression || [],
    },
  });

  const {
    control: step2Control,
    setValue: setStep2Value,
    watch: watchStep2,
    formState: { isValid: isStep2Valid },
  } = step2Form;

  // Initialize form when selection method changes to "specific" - only once
  useEffect(() => {
    if (formData.step2.selectionMethod === "specific" && formData.step2.specificUserExpression.length === 0) {
      setStep2Value("specificUserExpression", [], { shouldValidate: false });
    }
  }, [formData.step2.selectionMethod, setStep2Value]);

  // Watch step2 form values - sync from form to formData
  useEffect(() => {
    if (formData.step2.selectionMethod !== "specific") {
      return;
    }
    
    const subscription = watchStep2((values) => {
      const newExpression = values.specificUserExpression || [];
      setFormData((prev) => {
        // Only update if the expression actually changed and selection method is still "specific"
        if (prev.step2.selectionMethod !== "specific") {
          return prev;
        }
        const currentExpression = prev.step2.specificUserExpression || [];
        if (JSON.stringify(newExpression) !== JSON.stringify(currentExpression)) {
          return {
            ...prev,
            step2: {
              ...prev.step2,
              specificUserExpression: newExpression,
            },
          };
        }
        return prev;
      });
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.step2.selectionMethod]);

  // Validate Step 2
  useEffect(() => {
    let isValid = false;
    if (formData.step2.selectionMethod === "specific") {
      isValid = Array.isArray(formData.step2.specificUserExpression) && 
                formData.step2.specificUserExpression.length > 0 &&
                formData.step2.specificUserExpression.every(
                  (expr: any) => expr.attribute && expr.operator && expr.value
                );
    } else if (formData.step2.selectionMethod === "selectEach") {
      isValid = formData.step2.selectedUsers.length > 0;
    } else if (formData.step2.selectionMethod === "upload") {
      isValid = formData.step2.uploadedFile !== null;
    }
    setValidationStatus((prev) => {
      const newStatus = [...prev];
      newStatus[1] = isValid;
      return newStatus;
    });
  }, [formData.step2]);

  // Step 3 is always valid if we reach it
  useEffect(() => {
    if (currentStep === 3) {
      setValidationStatus((prev) => {
        const newStatus = [...prev];
        newStatus[2] = true;
        return newStatus;
      });
    }
  }, [currentStep]);

  const handleNext = () => {
    if (validationStatus[currentStep - 1] && currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // Here you would send the form data to your API
      console.log("Submitting user group:", JSON.stringify(formData));
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      alert(isEditMode ? "User Group updated successfully!" : "User Group created successfully!");
      router.push("/user");
    } catch (error) {
      console.error("Error creating user group:", error);
      alert("An error occurred while saving the user group. Please try again.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        step2: {
          ...prev.step2,
          uploadedFile: file,
        },
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Fixed step bar below header; aligned with content area */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-4"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        <div className="flex items-center gap-4 max-w-full">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium shrink-0 ${
                currentStep === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            <div className="flex-1 flex items-center min-w-0">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                        currentStep >= step.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]" aria-hidden />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="shrink-0">
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={!validationStatus[currentStep - 1]}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                    !validationStatus[currentStep - 1]
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isEditMode ? "Save Changes" : "Submit"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Spacer so content is not hidden under fixed step bar */}
        <div className="h-[72px]" aria-hidden />

        <div className="w-full py-8 px-4">
        {/* Form Content */}
        <div className="bg-white rounded-2xl border border-[#EEF0F2] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_14px_rgba(16,24,40,0.035)] p-6 mb-6 sm:p-8">
          {currentStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <label htmlFor="groupName" className="mb-1.5 block text-sm font-medium text-gray-700">
                  User Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="groupName"
                  type="text"
                  value={formData.step1.groupName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, groupName: e.target.value },
                    }))
                  }
                  placeholder="e.g. Operations - Managers"
                  className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="owner" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Owner <span className="text-red-500">*</span>
                </label>
                <input
                  id="owner"
                  type="text"
                  value={formData.step1.owner}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, owner: e.target.value },
                    }))
                  }
                  placeholder="e.g. jane.doe@company.com"
                  className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.step1.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    step1: { ...prev.step1, description: e.target.value },
                  }))
                }
                rows={4}
                placeholder="What is this group used for?"
                className="block w-full min-w-0 resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:items-end">
              <div>
                <label htmlFor="tags" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <input
                  id="tags"
                  type="text"
                  value={formData.step1.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, tags: e.target.value },
                    }))
                  }
                  placeholder="e.g. Operations, Finance"
                  className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                />
              </div>

              <label
                htmlFor="ownerIsReviewer"
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  id="ownerIsReviewer"
                  checked={formData.step1.ownerIsReviewer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, ownerIsReviewer: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Owner is Reviewer</span>
              </label>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Users Method <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                {[
                  { value: "specific", label: "Specific Users" },
                  { value: "selectEach", label: "Select Each User" },
                  { value: "upload", label: "Upload File" },
                ].map((option, index, array) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        step2: {
                          ...prev.step2,
                          selectionMethod: option.value as "specific" | "selectEach" | "upload",
                        },
                      }))
                    }
                    className={`px-4 py-2 min-w-16 rounded-md border border-gray-300 ${
                      formData.step2.selectionMethod === option.value
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    } ${index === 0 && "rounded-r-none"} ${
                      array.length > 2 &&
                      index === 1 &&
                      "rounded-none border-r-0 border-l-0"
                    } ${index === array.length - 1 && "rounded-l-none"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Option 1 - Specific Users */}
            {formData.step2.selectionMethod === "specific" && (
              <div>
                <ExpressionBuilder
                  title="Build Expression"
                  control={step2Control as Control<FieldValues>}
                  setValue={setStep2Value as UseFormSetValue<FieldValues>}
                  watch={watchStep2 as UseFormWatch<FieldValues>}
                  fieldName="specificUserExpression"
                />
              </div>
            )}

            {/* Option 2 - Select Each User */}
            {formData.step2.selectionMethod === "selectEach" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Users <span className="text-red-500">*</span>
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {users.map((user) => (
                    <label
                      key={user.email}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.step2.selectedUsers.includes(
                          user.email
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              step2: {
                                ...prev.step2,
                                selectedUsers: [
                                  ...prev.step2.selectedUsers,
                                  user.email,
                                ],
                              },
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              step2: {
                                ...prev.step2,
                                selectedUsers: prev.step2.selectedUsers.filter(
                                  (email) => email !== user.email
                                ),
                              },
                            }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span>
                        {user.name} ({user.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Option 3 - Upload File */}
            {formData.step2.selectionMethod === "upload" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      CSV, XLSX, XLS files only
                    </span>
                  </label>
                  {formData.step2.uploadedFile && (
                    <div className="mt-4 p-2 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">
                        Selected: {formData.step2.uploadedFile.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Group details summary */}
            <div className="rounded-2xl border border-[#EEF0F2] bg-white p-6 sm:p-8">
              <h2 className="mb-5 text-sm font-semibold text-blue-700">Group Details</h2>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Group Name
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formData.step1.groupName || "—"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Owner
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formData.step1.owner || "—"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Owner is Reviewer
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      formData.step1.ownerIsReviewer
                        ? "border border-green-500 bg-green-50 text-green-700"
                        : "border border-gray-300 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {formData.step1.ownerIsReviewer ? "Yes" : "No"}
                  </span>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Description
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {formData.step1.description || "No description provided"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Tags
                  </div>
                  {formData.step1.tags ? (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.step1.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag, i) => (
                        <span
                          key={`${tag}-${i}`}
                          className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">N/A</div>
                  )}
                </div>
              </div>
            </div>

            {/* User selection summary */}
            <div className="rounded-2xl border border-[#EEF0F2] bg-white p-6 sm:p-8">
              <h2 className="mb-5 text-sm font-semibold text-blue-700">User Selection</h2>
              <div className="mb-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Selection Method
                </div>
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {formData.step2.selectionMethod === "specific"
                    ? "Specific Users"
                    : formData.step2.selectionMethod === "selectEach"
                    ? "Select Each User"
                    : "Upload File"}
                </span>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Selected Users
                </div>

                {formData.step2.selectionMethod === "specific" && (
                  <div>
                    {formData.step2.specificUserExpression && formData.step2.specificUserExpression.length > 0 ? (
                      <div>
                        <p className="mb-2 text-sm text-gray-700">
                          {formData.step2.specificUserExpression.length} condition(s) defined
                        </p>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <pre className="whitespace-pre-wrap text-xs text-gray-700">
                            {JSON.stringify(
                              formData.step2.specificUserExpression.map((expr: any) => ({
                                attribute: expr.attribute?.label || expr.attribute?.value || "",
                                operator: expr.operator?.label || expr.operator?.value || "",
                                value: expr.value || "",
                                logicalOp: expr.logicalOp || "",
                              })),
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No conditions defined</p>
                    )}
                  </div>
                )}

                {formData.step2.selectionMethod === "selectEach" && (
                  <div>
                    <p className="mb-2 text-sm text-gray-700">
                      {formData.step2.selectedUsers.length} user(s) selected
                    </p>
                    {formData.step2.selectedUsers.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {formData.step2.selectedUsers.map((email) => {
                          const user = users.find((u) => u.email === email);
                          return (
                            <div
                              key={email}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                            >
                              <span className="font-medium text-gray-900">{user?.name || email}</span>
                              <span className="text-gray-500">{email}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {formData.step2.selectionMethod === "upload" && (
                  <div className="text-sm text-gray-700">
                    {formData.step2.uploadedFile?.name || "No file selected"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

