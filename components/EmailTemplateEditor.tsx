"use client";

import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { InfoIcon, ArrowLeft } from "lucide-react";

interface EmailTemplate {
  id: number;
  templateCode: string;
  templateName: string;
  description: string;
  subject: string;
  body: string;
  templateType: string;
  active: boolean;
}

interface EmailTemplateData {
  selectedTemplateId?: number;
  to: string;
  cc: string;
  bcc: string;
  templateName?: string;
}

interface EmailTemplateEditorProps {
  templateType: "start" | "reminders" | "escalation" | "closure";
  initialData?: EmailTemplateData;
  onSave?: (data: EmailTemplateData) => void;
}

interface ApiResponse {
  success: boolean;
  data: EmailTemplate[];
  message?: string;
  timestamp: string;
}

const DRAGGABLE_ROLES = [
  "Reviewer",
  "System Admin",
  "Certification Owner",
  "Reviewer Manager",
];

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  templateType,
  initialData,
  onSave,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EmailTemplateData>({
    defaultValues: initialData || {
      selectedTemplateId: undefined,
      to: "",
      cc: "",
      bcc: "",
    },
  });

  // Reset form when initialData changes (when editing)
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedRole, setDraggedRole] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const toInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const bccInputRef = useRef<HTMLInputElement>(null);

  // Fetch email templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "https://preview.keyforge.ai/kfmailserver/templates/api/v1/ACMECOM/getall"
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }

        const result: ApiResponse = await response.json();

        if (result.success && result.data) {
          // Filter only active templates
          const activeTemplates = result.data.filter((t) => t.active);
          setTemplates(activeTemplates);
          
          // If we have initialData, try to set the selectedTemplateId
          if (initialData) {
            let templateIdToSet: number | undefined = undefined;
            
            // If we already have a selectedTemplateId, use it
            if (initialData.selectedTemplateId) {
              templateIdToSet = initialData.selectedTemplateId;
            }
            // Otherwise, if we have a templateName, find the template by name
            else if (initialData.templateName) {
              const matchingTemplate = activeTemplates.find(
                (t) => t.templateName === initialData.templateName
              );
              if (matchingTemplate) {
                templateIdToSet = matchingTemplate.id;
              }
            }
            
            // Set the selectedTemplateId if we found one
            if (templateIdToSet !== undefined) {
              setValue("selectedTemplateId", templateIdToSet, { shouldValidate: true });
            }
          }
        } else {
          throw new Error(result.message || "Failed to load templates");
        }
      } catch (err) {
        console.error("Error fetching email templates:", err);
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [initialData, setValue]);

  const onSubmit = (data: EmailTemplateData) => {
    if (onSave) {
      const selectedTemplate = templates.find((t) => t.id === data.selectedTemplateId);
      onSave({
        ...data,
        templateName: selectedTemplate?.templateName || "",
      });
    }
    console.log("Email template saved:", data);
  };

  const handleDragStart = (e: React.DragEvent, role: string) => {
    setDraggedRole(role);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedRole(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, fieldName: "to" | "cc" | "bcc") => {
    e.preventDefault();
    if (draggedRole) {
      const currentValue = watch(fieldName) || "";
      const newValue = currentValue
        ? `${currentValue}, ${draggedRole}`
        : draggedRole;
      setValue(fieldName, newValue, { shouldValidate: true, shouldDirty: true });
      setDraggedRole(null);
    }
  };

  return (
    <div className="space-y-6">

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Draggable Roles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Drag and drop roles to To, CC or BCC:
          </label>
          <div className="flex gap-2">
            {DRAGGABLE_ROLES.map((role) => (
              <div
                key={role}
                draggable
                onDragStart={(e) => handleDragStart(e, role)}
                onDragEnd={handleDragEnd}
                className={`px-2 py-1.5 bg-blue-100 text-blue-700 rounded-md cursor-move hover:bg-blue-200 transition-colors text-sm whitespace-nowrap flex-1 ${
                  draggedRole === role ? "opacity-50" : ""
                }`}
              >
                {role}
              </div>
            ))}
          </div>
        </div>

        {/* To */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-16">
              To <span className="text-red-500">*</span>
            </label>
            <div className="flex-1">
              <input
                type="text"
                {...register("to", { required: "To field is required" })}
                value={watch("to") || ""}
                onChange={(e) => setValue("to", e.target.value, { shouldValidate: true })}
                ref={toInputRef}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "to")}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.to ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter To email addresses or drag roles here"
              />
            </div>
          </div>
          {errors.to && (
            <p className="text-red-500 text-sm mt-1 ml-16">{errors.to.message}</p>
          )}
        </div>

        {/* CC */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-16">
              CC
            </label>
            <div className="flex-1">
              <input
                type="text"
                {...register("cc")}
                value={watch("cc") || ""}
                onChange={(e) => setValue("cc", e.target.value)}
                ref={ccInputRef}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "cc")}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter CC email addresses or drag roles here"
              />
            </div>
          </div>
        </div>

        {/* BCC */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-16">
              BCC
            </label>
            <div className="flex-1">
              <input
                type="text"
                {...register("bcc")}
                value={watch("bcc") || ""}
                onChange={(e) => setValue("bcc", e.target.value)}
                ref={bccInputRef}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, "bcc")}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter BCC email addresses or drag roles here"
              />
            </div>
          </div>
        </div>

        {/* Email Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Email Template <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="text-sm text-gray-500 py-2">Loading templates...</div>
          ) : error ? (
            <div className="text-sm text-red-500 py-2">{error}</div>
          ) : (
            <div className="border border-gray-300 rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-12"></th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Template Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {templates.map((template) => (
                    <tr
                      key={template.id}
                      onClick={() => setValue("selectedTemplateId", template.id, { shouldValidate: true })}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                        watch("selectedTemplateId") === template.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={watch("selectedTemplateId") === template.id}
                          onChange={() => setValue("selectedTemplateId", template.id, { shouldValidate: true })}
                          className="scale-130 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{template.templateName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {template.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setValue("selectedTemplateId", template.id, { shouldValidate: true });
                            setShowPreview(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <InfoIcon size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.selectedTemplateId && (
            <p className="text-red-500 text-sm mt-1">{errors.selectedTemplateId.message}</p>
          )}
          <input
            type="hidden"
            {...register("selectedTemplateId", { required: "Please select a template" })}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={!watch("to") || !watch("selectedTemplateId")}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              watch("to") && watch("selectedTemplateId")
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Save Template
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={() => {
              // Reset to default values
              const form = document.querySelector('form');
              if (form) {
                form.reset();
              }
            }}
          >
            Reset
          </button>
        </div>
      </form>

      {/* Preview Modal - Inside Sidebar */}
      {showPreview && watch("selectedTemplateId") && (
        <div className="absolute inset-0 bg-white z-50 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Go Back</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {(() => {
                const selectedTemplate = templates.find(
                  (t) => t.id === Number(watch("selectedTemplateId"))
                );
                return selectedTemplate ? (
                  <>
                    {/* Subject Section */}
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        Subject
                      </h2>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200">
                        {selectedTemplate.subject || "-"}
                      </p>
                    </div>

                    {/* Body Section */}
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        Body
                      </h2>
                      <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[600px] overflow-y-auto">
                        {selectedTemplate.body ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: selectedTemplate.body }}
                            className="prose prose-sm max-w-none"
                          />
                        ) : (
                          <p className="text-gray-500">No body content available</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : null;
              })()}
            </div>

        </div>
      )}
    </div>
  );
};

export default EmailTemplateEditor;

