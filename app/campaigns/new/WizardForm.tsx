import { useState, useEffect } from "react";
import React from "react";
import SubmitDialog from "@/components/SubmitDialog";
import { useFormData } from "@/hooks/useFormData";
import { Step, FormData } from "@/types/stepTypes";
import { BookType, ChevronLeft, ChevronRight, Check, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiRequestWithAuth } from "@/lib/auth";
import { transformFormDataToPayload } from "./transformFormData";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
interface WizardFormProps {
  steps: Step[];
  initialFormData?: FormData | null;
  isEditMode?: boolean;
  editTemplateId?: string;
}

const WizardForm: React.FC<WizardFormProps> = ({ steps, initialFormData, isEditMode = false, editTemplateId }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useFormData();
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();

  // Pre-populate form data if editing
  useEffect(() => {
    if (initialFormData) {
      setFormData(initialFormData);
    }
  }, [initialFormData, setFormData]);
  const [validationStatus, setValidationStatus] = useState<boolean[]>(
    Array(steps.length).fill(false)
  );

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const router = useRouter();


  const handleSubmit = async () => {
    try {
      // Transform form data to API payload structure
      const payload = transformFormDataToPayload(formData);
      
      console.log("Transformed payload:", JSON.stringify(payload, null, 2));

      // Call the API to create the template/campaign
      const response = await apiRequestWithAuth<any>(
        "https://preview.keyforge.ai/campaign/api/v1/ACMECOM/createCampaign",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      console.log("Campaign created successfully:", response);
      
      // Show success message
      alert(saveAsTemplate 
        ? "Template saved successfully!" 
        : "Campaign created successfully!");
      
      // Navigate back to campaigns page
      router.push("/campaigns");
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      
      // Show error message
      const errorMessage = error.message || "An error occurred while creating the campaign. Please try again.";
      alert(`Failed to create campaign: ${errorMessage}`);
    }
  };

  const handleSave = async () => {
    try {
      if (!editTemplateId) {
        alert("Error: Campaign ID is missing. Cannot update template.");
        return;
      }

      // Wait a brief moment to ensure all form watch subscriptions have synced
      // This ensures we get the latest form data from all steps
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get the latest formData by using a function that reads current state
      // We'll use a ref-based approach or get the latest from state
      const getLatestFormData = () => {
        return new Promise<typeof formData>((resolve) => {
          setFormData((currentFormData) => {
            resolve(currentFormData);
            return currentFormData; // Don't change state
          });
        });
      };

      const latestFormData = await getLatestFormData();
      
      // Transform form data to API payload structure
      const payload = transformFormDataToPayload(latestFormData);
      
      // Include the campaign ID in payload
      payload.campaignID = editTemplateId;
      payload.id = editTemplateId;
      
      console.log("Current formData before transform:", JSON.stringify(latestFormData, null, 2));
      console.log("Transformed payload for update:", JSON.stringify(payload, null, 2));

      // Call the update campaign API endpoint
      const response = await apiRequestWithAuth<any>(
        `https://preview.keyforge.ai/campaign/api/v1/ACMECOM/updateCampaign/${editTemplateId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      console.log("Campaign updated successfully:", response);
      
      // Show success message for update
      alert("Template updated successfully!");
      
      // Navigate back to campaigns page with template tab
      router.push("/campaigns?tab=template");
    } catch (error: any) {
      console.error("Error updating campaign:", error);
      
      // Show error message
      const errorMessage = error.message || "An error occurred while updating the template. Please try again.";
      alert(`Failed to update template: ${errorMessage}`);
    }
  };

  const handleValidationChange = (isValid: boolean) => {
    setValidationStatus((prev) => {
      if (prev[currentStep] !== isValid) {
        const newStatus = [...prev];
        newStatus[currentStep] = isValid;
        return newStatus;
      }
      return prev;
    });
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1 && validationStatus[currentStep]) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1); // Go to the previous step
    }
  };
  const handleClose = () => {
    router.push("/campaigns?tab=template");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Step bar: fixed below header, full width (respecting sidebar) */}
      <div
        className="fixed top-[60px] right-0 z-20 bg-white shadow-sm border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-3.5 border-t border-gray-200"
        style={{ left: isSidebarVisible ? sidebarWidthPx : 0 }}
      >
          <div className="flex items-center gap-2 sm:gap-8 min-w-0">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`flex items-center px-2 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium shrink-0 ${
                currentStep === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2.5" />
              Previous
            </button>
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 min-w-0 w-full">
                {steps.map((step, index) => {
                  const stepId = index + 1;
                  const isClickable = index <= currentStep || validationStatus.slice(0, index).every(Boolean);
                  return (
                    <div key={index} className="flex items-center min-w-0 flex-1 sm:flex-initial">
                      <div
                        className={`flex items-center ${isClickable ? "cursor-pointer" : "cursor-not-allowed"}`}
                        onClick={() => {
                          if (isClickable && (index <= currentStep || validationStatus.slice(0, index).every(Boolean))) {
                            setCurrentStep(index);
                          }
                        }}
                      >
                        <div
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 ${
                            currentStep >= index ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {currentStep > index ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : stepId}
                        </div>
                        <div className="ml-1.5 sm:ml-3 min-w-0 overflow-hidden flex-1">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate" title={step.name}>{step.name}</p>
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 sm:flex-initial w-2 sm:w-14 md:w-20 h-0.5 bg-gray-200 mx-0.5 sm:mx-5 shrink-0 max-w-2 sm:max-w-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1 sm:gap-4 shrink-0">
              {isEditMode && (
                <button
                  onClick={handleSave}
                  className="flex items-center px-2 sm:px-5 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm font-medium"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2.5" />
                  Save
                </button>
              )}
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={nextStep}
                  disabled={!validationStatus[currentStep]}
                  className={`flex items-center px-2 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
                    validationStatus[currentStep]
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2.5" />
                </button>
              ) : !isEditMode ? (
                <button
                  onClick={() => {
                    setIsDialogOpen(true);
                    setSaveAsTemplate(false);
                  }}
                  disabled={!validationStatus[currentStep]}
                  className={`flex items-center px-2 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
                    validationStatus[currentStep]
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2.5" />
                  Create Campaign
                </button>
              ) : null}
              <button
                className="p-1.5 sm:p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-red-500 hover:text-red-600 transition-colors shrink-0"
                onClick={() => setShowCloseConfirm(true)}
                title="Close"
                aria-label="Close form"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
      </div>

      {/* Spacer so content is not under fixed bar (header 60px + bar height) */}
      <div className="w-full pt-[80px] px-4 pb-8">
        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6" key={`step-${currentStep}`}>
          {steps[currentStep].component({
            formData,
            setFormData,
            onValidationChange: handleValidationChange,
          })}
        </div>
      </div>

      <SubmitDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleSubmit}
        saveAsTemplate={saveAsTemplate}
        setSaveAsTemplate={setSaveAsTemplate}
        certificationTemplate={formData.step1?.certificationTemplate || ""}
        setCertificationTemplate={(value) =>
          setFormData((prev) => ({
            ...prev,
            step1: { ...prev.step1, certificationTemplate: value },
          }))
        }
      />

      {/* Close confirmation modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="close-confirm-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 id="close-confirm-title" className="text-lg font-semibold text-gray-900 mb-2">Close campaign?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Any unsaved changes will be lost. Do you want to close?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  handleClose();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WizardForm;





// "use client";

// interface WizardFormProps {
//   steps: Step[];
// }

//     Array(steps.length).fill(false)
//   );

//     try {
//       setIsDialogOpen(true);

//       // Transform formData into the API body structure
//         name: formData.step1?.certificationTemplate || "",
//         description: formData.step1?.description || "",
//         campaignType: formData.step2?.campaignType || "User", // Map campaignType (adjust if needed)
//         copyFromTemplate: formData.step1?.template || "",
//         campaignOwner: {
//           ownerType: formData.step1?.ownerType || "User",
//           ownerName: formData.step1?.ownerType === "User"
//             ? formData.step1?.ownerUser?.map(user => user.value) || []
//             : formData.step1?.ownerGroup?.map(group => group.value) || [],
//         },
//         certificationDuration: Number(formData.step1?.duration) || 90,
//         campaignID: "",
//         campaignDefinitionType: "MASTER",
//         campaignDefinitionParentID: "",
//         campaignDefinitionMasterID: "",
//         reviewers: formData.step3?.stages?.map((stage, index) => ({
//           stage: index + 1,
//           reviewDuration: Number(stage.duration) || 30,
//           reviewerType: stage.reviewer || "Manager",
//           description: `Stage ${index + 1} review`,
//           reviewerID: stage.reviewer === "custom-reviewer" && stage.customReviewerlist
//             ? "custom" // Adjust based on actual logic
//             : "",
//           customCertifiers: stage.reviewer === "custom-reviewer"
//             ? stage.genericExpression?.map(exp => ({
//                 attribute: exp.attribute?.value,
//                 operator: exp.operator?.value,
//                 value: exp.value,
//               })) || []
//             : [],
//         })) || [],
//         userCriteria: {
//           criteria: formData.step2?.userType === "All users" ? "allUsers"
//             : formData.step2?.userType === "Specific users" ? "selectedUsers"
//             : "customUserGroups",
//           selectedUsers: formData.step2?.specificUserExpression?.map(exp => ({
//             attribute: exp.attribute?.value,
//             operator: exp.operator?.value,
//             value: exp.value,
//           })) || [],
//           excludeUsersFromCampaign: formData.step2?.excludeUsersIsChecked
//             ? formData.step2?.excludeUsers?.map(user => user.value) || []
//             : [],
//           customUserGroups: formData.step2?.userType === "Custom User Group" && formData.step2?.groupListIsChecked
//             ? [formData.step2?.importNewUserGroup?.name || "Imported Group"]
//             : formData.step2?.userGroupList ? [formData.step2.userGroupList] : [],
//           filtercriteria: formData.step2?.specificUserExpression?.length > 0
//             ? {
//                 condition: "AND", // Adjust based on ExpressionBuilder logic
//                 children: null,
//                 attribute: formData.step2?.specificUserExpression[0]?.attribute?.value || null,
//                 operator: formData.step2?.specificUserExpression[0]?.operator?.value || null,
//                 value: formData.step2?.specificUserExpression[0]?.value || null,
//               }
//             : { condition: null, children: null, attribute: null, operator: null, value: null },
//         },
//         scopingCriteria: {
//           criteria: formData.step2?.selectData === "All Applications" ? "allApplications"
//             : formData.step2?.selectData === "Specific Applications" ? "selectedApplications"
//             : "specificEntitlements",
//           selectedApplications: formData.step2?.specificApps?.map(app => app.value) || [],
//           commonFilterForAccounts: {
//             criteria: formData.step2?.applicationScope ? "allUserAccounts" : "allAccounts",
//             filtercriteria: formData.step2?.expressionApps?.length > 0
//               ? {
//                   condition: "AND",
//                   children: null,
//                   attribute: formData.step2?.expressionApps[0]?.attribute?.value || null,
//                   operator: formData.step2?.expressionApps[0]?.operator?.value || null,
//                   value: formData.step2?.expressionApps[0]?.value || null,
//                 }
//               : { condition: null, children: null, attribute: null, operator: null, value: null },
//             createdAfter: "",
//             assignedAfter: null,
//           },
//           appSpecificFilter: [],
//           commonFilterForEntitlements: {
//             criteria: formData.step2?.selectData === "Select Entitlement" ? "specificEntitlements" : "allEntitlementsOfAccount",
//             filtercriteria: formData.step2?.expressionEntitlement?.length > 0
//               ? {
//                   condition: "AND",
//                   children: null,
//                   attribute: formData.step2?.expressionEntitlement[0]?.attribute?.value || null,
//                   operator: formData.step2?.expressionEntitlement[0]?.operator?.value || null,
//                   value: formData.step2?.expressionEntitlement[0]?.value || null,
//                 }
//               : { condition: null, children: null, attribute: null, operator: null, value: null },
//             createdAfter: null,
//             assignedAfter: formData.step2?.selectData === "Select Entitlement" ? "All Entitlements assigned after particular date" : null,
//           },
//           specificEntitlementsFilter: [],
//         },
//         reminders: {
//           enabled: formData.step4?.socReminders?.length > 0 || formData.step4?.eocReminders?.length > 0,
//           frequencyInDays: 7, // Hardcoded as per API body; adjust if form captures this
//           notificationTemplate: {
//             subject: `Reminder: Access Review for Campaign ${formData.step1?.certificationTemplate || "Campaign"}`,
//           },
//         },
//         notifications: {
//           onStart: {
//             notificationTemplate: {
//               subject: `Access Review Started: ${formData.step1?.certificationTemplate || "Campaign"}`,
//             },
//           },
//           onCompletion: {
//             notificationTemplate: {
//               subject: `Access Review Completed: ${formData.step1?.certificationTemplate || "Campaign"}`,
//             },
//           },
//           beforeExpiry: {
//             numOfDaysBeforeExpiry: formData.step4?.eocReminders?.map(reminder => Number(reminder.value)) || [7, 5, 3, 2],
//             notificationTemplate: {
//               subject: `Access Review about to Expire: ${formData.step1?.certificationTemplate || "Campaign"}`,
//             },
//           },
//           onEscalation: {
//             notificationTemplate: {
//               subject: `Escalation: Pending Access Review for ${formData.step1?.certificationTemplate || "Campaign"}`,
//             },
//           },
//         },
//         escalation: {
//           enabled: formData.step4?.allowEscalation ? true : false,
//           daysBeforeExpiry: Number(formData.step4?.allowEscalation) || 1,
//         },
//         certificationOptions: {
//           allowDelegation: false, // Not captured in form; hardcoded as per API body
//           allowPreDelegateToSignOff: formData.step4?.preDelegate || false,
//           requireCommentOnRevoke: formData.step4?.enforceComments === "Revoke" || formData.step4?.enforceComments === "Custom Fields",
//           requireCommentOnCertify: formData.step4?.enforceComments === "Certify" || formData.step4?.enforceComments === "Custom Fields",
//           closedLoopRemediation: formData.step4?.remediationTicketing || false,
//           defaultCertifier: {
//             type: formData.step4?.certifierUnavailableUsers?.length > 0 ? "User" : "",
//             reviewerId: formData.step4?.certifierUnavailableUsers?.[0]?.value || "ASRO",
//           },
//         },
//         campaignSchedular: {
//           startDate: formData.step4?.startDate?.toISOString() || "",
//           frequency: Number(formData.step4?.reviewRecurrence) || 7,
//           endOfCampaign: formData.step4?.end || "",
//         },
//       };

//       // Replace with your actual API endpoint
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(apiBody),

//       if (!response.ok) {
//         throw new Error(`HTTP error! Status: ${response.status}`);
//       }

//       if (responseText) {
//         console.log("Form submission successful:", jsonData);
//         setIsDialogOpen(false);
//         alert("Campaign created successfully!");
//       } else {
//         console.warn("Empty response received from server.");
//         alert("Submission failed. No data received.");
//       }
//     } catch (error) {
//       console.error("Error submitting form:", error);
//       setIsDialogOpen(false);
//       alert("An error occurred while creating the campaign. Please try again.");
//     }
//   };

//       if (prev[currentStep] !== isValid) {
//         newStatus[currentStep] = isValid;
//       }
//   };

//     if (validationStatus[currentStep] && currentStep < steps.length - 1) {
//       setCurrentStep((prev) => prev + 1);
//     }
//   };

//     if (currentStep > 0) {
//       setCurrentStep((prev) => prev - 1);
//     }
//   };

//     <>
//       <WizardSteps
//         currentStep={currentStep}
//         steps={steps}
//         validationStatus={validationStatus}
//           if (
//             step <= currentStep ||
//             validationStatus.slice(0, step).every(Boolean)
//           ) {
//             setCurrentStep(step);
//           }
//         }}
//       />
//         {steps[currentStep].component({
//           formData,
//           setFormData,
//           onValidationChange: handleValidationChange,
//         })}
//       </div>
//       <SubmitDialog
//         isOpen={isDialogOpen}
//         onClose={() => setIsDialogOpen(false)}
//         saveAsTemplate={saveAsTemplate}
//         setSaveAsTemplate={setSaveAsTemplate}
//         certificationTemplate={formData.step1?.certificationTemplate || ""}
//         setCertificationTemplate={(value) =>
//           setFormData((prev) => ({
//             ...prev,
//             step1: { ...prev.step1, certificationTemplate: value },
//           }))
//         }
//       />
//         <button
//           className={`rounded px-4 py-2 flex gap-2 bg-blue-500 hover:bg-blue-500/80 text-white ${
//             currentStep === 0 ? "opacity-50 cursor-not-allowed" : ""
//           }`}
//           onClick={prevStep}
//           disabled={currentStep === 0}
//           hidden={currentStep === 0}
//         >
//         </button>

//         {currentStep < steps.length - 1 ? (
//           <button
//             className={`rounded px-4 py-2 flex gap-2 bg-blue-500 hover:bg-blue-500/80 text-white 
//         ${validationStatus[currentStep] ? "" : "opacity-50 cursor-not-allowed"}`}
//             onClick={nextStep}
//             disabled={!validationStatus[currentStep]}
//           >
//           </button>
//         ) : (
//             <button
//               className={`px-4 py-2 rounded cursor-pointer flex gap-2 items-center bg-[#8b03c6] text-white hover:bg-[#8b03c6]/80 ${
//                 currentStep === steps.length - 1 &&
//                 validationStatus[currentStep]
//                   ? ""
//                   : "opacity-50 cursor-not-allowed"
//               }`}
//               disabled={
//                 currentStep === steps.length - 1
//                   ? !validationStatus[currentStep]
//                   : true
//               }
//                 setIsDialogOpen(true);
//                 setSaveAsTemplate(true);
//                 handleSubmit();
//               }}
//             >
//             </button>
//             <button
//               className={`px-4 py-2 rounded cursor-pointer flex gap-2 items-center bg-[#15274E] text-white hover:bg-[#15274E]/80 ${
//                 currentStep === steps.length - 1 &&
//                 validationStatus[currentStep]
//                   ? ""
//                   : "opacity-50 cursor-not-allowed"
//               }`}
//               disabled={
//                 currentStep === steps.length - 1
//                   ? !validationStatus[currentStep]
//                   : true
//               }
//                 setIsDialogOpen(true);
//                 setSaveAsTemplate(false);
//                 handleSubmit();
//               }}
//             >
//               Prepare Campaign
//             </button>
//           </div>
//         )}
//       </div>
//     </>
//   );
// };

