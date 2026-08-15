"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Mail, ChevronDown, Bold, Italic, Underline, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link, Image, Table, Code, Quote, Minus, Maximize2, HelpCircle } from "lucide-react";

interface EmailTemplateFormData {
  templateCode: string;
  templateName: string;
  description: string;
  subject: string;
  body: string;
  templateType: "HTML" | "PLAIN_TEXT";
  active: boolean;
  createdBy: string;
  updatedBy: string;
}

interface EmailTemplate {
  id: number;
  templateCode: string;
  templateName: string;
  description: string;
  subject: string;
  body: string;
  templateType: string;
  active: boolean;
  parameters: string[];
  mandatoryEmailParameters: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface AttributesResponse {
  success: boolean;
  message: string;
  data: string[];
  timestamp: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: EmailTemplate[];
  timestamp: string;
}

// Default email template body
const DEFAULT_EMAIL_TEMPLATE_BODY = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certification Review Assignment</title>
<style>
body {
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
line-height: 1.6;
color: #333333;
background-color: #f4f4f4;
margin: 0;
padding: 0;
}
.email-container {
max-width: 650px;
margin: 20px auto;
background-color: #ffffff;
border-radius: 8px;
overflow: hidden;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.header {
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: #ffffff;
padding: 30px;
text-align: center;
}
.header h1 {
margin: 0;
font-size: 24px;
font-weight: 600;
}
.content {
padding: 30px;
}
.greeting {
font-size: 16px;
margin-bottom: 20px;
}
.intro {
margin-bottom: 25px;
color: #555555;
}
.details-section {
background-color: #f8f9fa;
border-left: 4px solid #667eea;
padding: 20px;
margin: 25px 0;
border-radius: 4px;
}
.details-title {
font-size: 18px;
font-weight: 600;
color: #333333;
margin-bottom: 15px;
display: flex;
align-items: center;
}
.details-title::before {
content: "";
margin-right: 8px;
}
.separator {
border-top: 2px solid #e0e0e0;
margin: 15px 0;
}
.detail-row {
display: flex;
padding: 8px 0;
border-bottom: 1px solid #e8e8e8;
}
.detail-row:last-child {
border-bottom: none;
}
.detail-label {
font-weight: 600;
color: #555555;
min-width: 180px;
flex-shrink: 0;
}
.detail-value {
color: #333333;
word-break: break-word;
}
.action-button {
display: inline-block;
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: #ffffff;
text-decoration: none;
padding: 14px 32px;
border-radius: 5px;
font-weight: 600;
font-size: 16px;
margin: 25px 0;
text-align: center;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
transition: transform 0.2s;
}
.action-button:hover {
transform: translateY(-2px);
box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
}
.important-notes {
background-color: #fff3cd;
border-left: 4px solid #ffc107;
padding: 15px;
margin: 25px 0;
border-radius: 4px;
}
.important-notes-title {
font-weight: 600;
color: #856404;
margin-bottom: 10px;
display: flex;
align-items: center;
}
.important-notes-title::before {
content: "";
margin-right: 8px;
}
.note-list {
margin: 0;
padding-left: 20px;
color: #856404;
}
.note-list li {
margin: 8px 0;
}
.support-info {
background-color: #e7f3ff;
border-left: 4px solid #2196F3;
padding: 15px;
margin: 20px 0;
border-radius: 4px;
color: #0c5460;
}
.footer {
background-color: #f8f9fa;
padding: 25px;
text-align: center;
border-top: 1px solid #e0e0e0;
}
.signature {
margin: 20px 0;
color: #555555;
}
.disclaimer {
font-size: 12px;
color: #888888;
margin-top: 20px;
font-style: italic;
}
.organization-name {
font-weight: 600;
color: #667eea;
}
@media only screen and (max-width: 600px) {
.email-container {
margin: 10px;
}
.content {
padding: 20px;
}
.detail-row {
flex-direction: column;
}
.detail-label {
margin-bottom: 5px;
}
.action-button {
display: block;
width: 100%;
}
}
</style>
</head>
<body>
<div class="email-container">
<!-- Header -->
<div class="header">
<h1>Certification Review Assignment</h1>
</div>

<!-- Content -->
<div class="content">
<!-- Greeting -->
<div class="greeting">
Dear <strong>\${USER_NAME}</strong>,
</div>

<!-- Introduction -->
<div class="intro">
You have been assigned as a reviewer for a new certification instance.
Please review the details below and complete the certification within the specified timeline.
</div>

<!-- Certification Details -->
<div class="details-section">
<div class="details-title">Certification Details</div>
<div class="separator"></div>

<div class="detail-row">
<div class="detail-label">Your ID</div>
<div class="detail-value"><strong>\${REVIEWER_ID}</strong></div>
</div>

<div class="detail-row">
<div class="detail-label">Certification Name</div>
<div class="detail-value"><strong>\${CERTIFICATION_NAME}</strong></div>
</div>

<div class="detail-row">
<div class="detail-label">Certification ID</div>
<div class="detail-value">\${CERTIFICATION_ID}</div>
</div>

<div class="detail-row">
<div class="detail-label">Campaign Name</div>
<div class="detail-value">\${CERTIFICATION_NAME}</div>
</div>

<div class="detail-row">
<div class="detail-label">Start Date</div>
<div class="detail-value">\${CERT_START_AT}</div>
</div>

<div class="detail-row">
<div class="detail-label">Expiry Date</div>
<div class="detail-value"><strong style="color: #d32f2f;">\${CERT_DUE_AT}</strong></div>
</div>

<div class="detail-row">
<div class="detail-label">Assigned On</div>
<div class="detail-value">\${CERT_ASSIGNED_AT}</div>
</div>
</div>

<!-- Action Button -->
<div style="text-align: center;">
<a href="\${PLATFORMURL}" class="action-button">
Access Certification Platform
</a>
</div>

<!-- Important Notes -->
<div class="important-notes">
<div class="important-notes-title">Important Notes</div>
<ul class="note-list">
<li>Please ensure all assigned items are reviewed before the expiry date.</li>
<li>Any items not reviewed before expiry may be automatically actioned as per policy.</li>
<li>Your actions will be recorded for audit and compliance purposes.</li>
</ul>
</div>

<!-- Support Information -->
<div class="support-info">
<strong>Need Help?</strong><br>
If you have any questions or face access issues, please contact the Identity Governance support team.
</div>

<!-- Signature -->
<div class="signature">
Thank you for your cooperation.<br><br>
<strong>Regards,</strong><br>
Identity Governance Team<br>
<span class="organization-name">\${ORGANIZATIONNAME}</span>
</div>
</div>

<!-- Footer -->
<div class="footer">
<div class="disclaimer">
This is a system-generated email. Please do not reply to this message.
</div>
</div>
</div>
</body>
</html>`;

export default function EditEmailTemplatePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const editorRef = useRef<HTMLDivElement>(null);
  const htmlSourceRef = useRef<HTMLTextAreaElement>(null);
  const [focusedFields, setFocusedFields] = useState<Record<string, boolean>>({});
  const [isHtmlView, setIsHtmlView] = useState(true);
  const [attributes, setAttributes] = useState<string[]>([]);
  const [attributesLoading, setAttributesLoading] = useState(true);
  const [attributesError, setAttributesError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ start: number; end: number } | null>(null);
  const [focusedFieldName, setFocusedFieldName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<EmailTemplateFormData>({
    templateCode: "",
    templateName: "",
    description: "",
    subject: "",
    body: DEFAULT_EMAIL_TEMPLATE_BODY,
    templateType: "HTML",
    active: true,
    createdBy: "",
    updatedBy: "",
  });

  // Fetch template data on mount
  useEffect(() => {
    const fetchTemplate = async () => {
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
          const templateId = parseInt(params.id);
          const foundTemplate = result.data.find((t) => t.id === templateId);
          
          if (foundTemplate) {
            // Populate form with existing template data
            setFormData({
              templateCode: foundTemplate.templateCode || "",
              templateName: foundTemplate.templateName || "",
              description: foundTemplate.description || "",
              subject: foundTemplate.subject || "",
              body: foundTemplate.body || DEFAULT_EMAIL_TEMPLATE_BODY,
              templateType: (foundTemplate.templateType === "PLAIN_TEXT" ? "PLAIN_TEXT" : "HTML") as "HTML" | "PLAIN_TEXT",
              active: foundTemplate.active ?? true,
              createdBy: foundTemplate.createdBy || "",
              updatedBy: foundTemplate.updatedBy || "",
            });

            // Set editor content
            if (foundTemplate.templateType === "HTML") {
              setIsHtmlView(true);
              if (htmlSourceRef.current) {
                htmlSourceRef.current.value = foundTemplate.body || DEFAULT_EMAIL_TEMPLATE_BODY;
              }
              if (editorRef.current) {
                editorRef.current.innerHTML = foundTemplate.body || DEFAULT_EMAIL_TEMPLATE_BODY;
              }
            } else {
              setIsHtmlView(false);
            }
          } else {
            throw new Error("Template not found");
          }
        } else {
          throw new Error(result.message || "Failed to load template");
        }
      } catch (err) {
        console.error("Error fetching email template:", err);
        setError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchTemplate();
    }
  }, [params.id]);

  const handleFieldChange = (field: keyof EmailTemplateFormData, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFieldFocus = (field: string) => {
    setFocusedFields((prev) => ({ ...prev, [field]: true }));
    setFocusedFieldName(field);
  };

  const handleFieldBlur = (field: string) => {
    setFocusedFields((prev) => ({ ...prev, [field]: false }));
    // Don't clear focusedFieldName immediately, keep it for attribute insertion
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.templateCode || !formData.templateName || !formData.subject || !formData.body) {
        alert("Please fill in all required fields (Template Code, Template Name, Subject, Body)");
        return;
      }

      // Prepare payload based on template type
      const payload = {
        id: parseInt(params.id),
        templateCode: formData.templateCode,
        templateName: formData.templateName,
        description: formData.description || "",
        subject: formData.subject,
        body: formData.body,
        templateType: formData.templateType,
        active: formData.active,
        createdBy: formData.createdBy || "system",
        updatedBy: formData.updatedBy || "system",
      };

      // Call API to update template
      const response = await fetch(
        "https://preview.keyforge.ai/kfmailserver/templates/api/v1/ACMECOM/update",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || "Failed to update template");
      }

      // Navigate back to template detail page
      router.push(`/settings/gateway/email-templates/${params.id}`);
    } catch (error) {
      console.error("Error updating template:", error);
      alert(`Failed to update template: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleCancel = () => {
    router.push(`/settings/gateway/email-templates/${params.id}`);
  };

  // Fetch attributes on mount
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        setAttributesLoading(true);
        setAttributesError(null);
        
        const response = await fetch(
          "https://preview.keyforge.ai/kfmailserver/templates/api/v1/ACMECOM/getallattributes"
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch attributes: ${response.statusText}`);
        }

        const result: AttributesResponse = await response.json();

        if (result.success && result.data) {
          setAttributes(result.data);
        } else {
          throw new Error(result.message || "Failed to load attributes");
        }
      } catch (err) {
        console.error("Error fetching attributes:", err);
        setAttributesError(err instanceof Error ? err.message : "Failed to load attributes");
      } finally {
        setAttributesLoading(false);
      }
    };

    fetchAttributes();
  }, []);

  // Initialize editor content when template type changes
  useEffect(() => {
    if (formData.templateType === "HTML" && formData.body) {
      if (editorRef.current) {
        editorRef.current.innerHTML = formData.body;
      }
      if (htmlSourceRef.current) {
        htmlSourceRef.current.value = formData.body;
      }
    }
  }, [formData.templateType, formData.body]);

  // Rich text editor toolbar actions
  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      handleFieldChange("body", editorRef.current.innerHTML);
    }
  };

  // Toggle between HTML source view and visual editor
  const toggleHtmlView = () => {
    if (isHtmlView) {
      // Switching from HTML view to visual editor
      if (htmlSourceRef.current && editorRef.current) {
        const htmlContent = htmlSourceRef.current.value;
        editorRef.current.innerHTML = htmlContent;
        handleFieldChange("body", htmlContent);
      }
    } else {
      // Switching from visual editor to HTML view
      if (editorRef.current && htmlSourceRef.current) {
        htmlSourceRef.current.value = formData.body;
      }
    }
    setIsHtmlView(!isHtmlView);
  };

  // Handle HTML source changes
  const handleHtmlSourceChange = (value: string) => {
    handleFieldChange("body", value);
  };

  // Insert attribute into currently focused field at cursor position
  const insertAttribute = (attribute: string) => {
    const attributeText = "${" + attribute + "}";
    
    // Check if subject field is focused
    if (focusedFieldName === "subject" && subjectRef.current) {
      const input = subjectRef.current;
      const start = cursorPosition?.start ?? input.selectionStart ?? input.value.length;
      const end = cursorPosition?.end ?? input.selectionEnd ?? input.value.length;
      const text = formData.subject;
      const newText = text.substring(0, start) + attributeText + text.substring(end);
      
      handleFieldChange("subject", newText);
      
      setTimeout(() => {
        input.focus();
        const newPosition = start + attributeText.length;
        input.setSelectionRange(newPosition, newPosition);
        setCursorPosition({
          start: newPosition,
          end: newPosition
        });
      }, 10);
      return;
    }
    
    // Otherwise, insert into body field
    if (formData.templateType === "HTML") {
      if (isHtmlView && htmlSourceRef.current) {
        const textarea = htmlSourceRef.current;
        // Store current scroll position
        const scrollTop = textarea.scrollTop;
        // Use stored cursor position if available, otherwise use current selection
        const start = cursorPosition?.start ?? textarea.selectionStart ?? textarea.value.length;
        const end = cursorPosition?.end ?? textarea.selectionEnd ?? textarea.value.length;
        const text = formData.body; // Use formData.body to ensure we have the latest value
        const newText = text.substring(0, start) + attributeText + text.substring(end);
        
        // Update the form data
        handleFieldChange("body", newText);
        
        // Set cursor position after inserted text and restore scroll position
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (htmlSourceRef.current) {
              const textarea = htmlSourceRef.current;
              textarea.focus();
              const newPosition = start + attributeText.length;
              textarea.setSelectionRange(newPosition, newPosition);
              // Restore scroll position
              textarea.scrollTop = scrollTop;
              // Update cursor position state
              setCursorPosition({
                start: newPosition,
                end: newPosition
              });
            }
          }, 0);
        });
      } else if (editorRef.current) {
        // For visual editor, insert as text
        editorRef.current.focus();
        document.execCommand("insertText", false, attributeText);
        handleFieldChange("body", editorRef.current.innerHTML);
      }
    } else {
      // For plain text, find the textarea and insert
      const textareas = document.querySelectorAll('textarea');
      const plainTextTextarea = Array.from(textareas).find(
        (ta) => ta.value === formData.body || ta.placeholder?.includes('plain text')
      ) as HTMLTextAreaElement;
      
      if (plainTextTextarea) {
        // Store current scroll position
        const scrollTop = plainTextTextarea.scrollTop;
        // Use stored cursor position if available, otherwise use current selection
        const start = cursorPosition?.start ?? plainTextTextarea.selectionStart ?? plainTextTextarea.value.length;
        const end = cursorPosition?.end ?? plainTextTextarea.selectionEnd ?? plainTextTextarea.value.length;
        const text = formData.body; // Use formData.body to ensure we have the latest value
        const newText = text.substring(0, start) + attributeText + text.substring(end);
        
        handleFieldChange("body", newText);
        
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          setTimeout(() => {
            const textareas = document.querySelectorAll('textarea');
            const updatedTextarea = Array.from(textareas).find(
              (ta) => ta.value === newText || ta.placeholder?.includes('plain text')
            ) as HTMLTextAreaElement;
            
            if (updatedTextarea) {
              updatedTextarea.focus();
              const newPosition = start + attributeText.length;
              updatedTextarea.setSelectionRange(newPosition, newPosition);
              // Restore scroll position
              updatedTextarea.scrollTop = scrollTop;
              // Update cursor position state
              setCursorPosition({
                start: newPosition,
                end: newPosition
              });
            }
          }, 0);
        });
      } else {
        // Fallback: append to end
        handleFieldChange("body", formData.body + attributeText);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#27B973] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-6">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
          <p className="font-medium">Error loading template</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6" style={{ overflow: 'visible', paddingRight: '360px' }}>
      <div className="flex gap-6 items-start" style={{ position: 'relative' }}>
        {/* Main Section */}
        <div className="flex-1 bg-white rounded-md shadow overflow-hidden">
            {/* Green Header Bar */}
            <div className="flex items-center justify-between px-5 py-3 text-white" style={{ backgroundColor: '#27B973' }}>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 185, 115, 0.6)' }}>
                  <Mail className="w-4 h-4" />
                </div>
                <h2 className="font-semibold">Edit Email Template</h2>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="p-8">
            {/* Form Fields */}
            <div className="space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  <p className="text-sm text-gray-500 mt-1">Provide the essential details for your email template</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Template Code */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Code <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 font-normal ml-1">(must be unique)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.templateCode}
                      onChange={(e) => {
                        const transformedValue = e.target.value.toUpperCase().replace(/\s+/g, '_');
                        handleFieldChange("templateCode", transformedValue);
                      }}
                      onFocus={() => handleFieldFocus("templateCode")}
                      onBlur={() => handleFieldBlur("templateCode")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                      placeholder="e.g., CERT_REVIEW_ASSIGNMENT"
                    />
                  </div>

                  {/* Template Name */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.templateName}
                      onChange={(e) => handleFieldChange("templateName", e.target.value)}
                      onFocus={() => handleFieldFocus("templateName")}
                      onBlur={() => handleFieldBlur("templateName")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                      placeholder="e.g., Certification Review Assignment Email"
                    />
                  </div>
                </div>

                {/* Description - Full Width */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-xs text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    onFocus={() => handleFieldFocus("description")}
                    onBlur={() => handleFieldBlur("description")}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                    placeholder="Brief description of what this template is used for"
                  />
                </div>

                {/* Template Type and Active Status Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Template Type */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.templateType}
                        onChange={(e) => handleFieldChange("templateType", e.target.value as "HTML" | "PLAIN_TEXT")}
                        onFocus={() => handleFieldFocus("templateType")}
                        onBlur={() => handleFieldBlur("templateType")}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white transition-all"
                      >
                        <option value="HTML">HTML</option>
                        <option value="PLAIN_TEXT">Plain Text</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Active Status */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <div className="flex items-center h-10">
                      <button
                        type="button"
                        onClick={() => handleFieldChange("active", !formData.active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          formData.active ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                            formData.active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-sm text-gray-600">
                        {formData.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Content Section */}
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Email Content</h3>
                  <p className="text-sm text-gray-500 mt-1">Define the subject and body of your email template</p>
                </div>

                {/* Subject */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={subjectRef}
                    type="text"
                    value={formData.subject}
                    onChange={(e) => {
                      handleFieldChange("subject", e.target.value);
                      // Track cursor position on change
                      const target = e.target as HTMLInputElement;
                      setCursorPosition({
                        start: target.selectionStart ?? 0,
                        end: target.selectionEnd ?? 0
                      });
                    }}
                    onFocus={() => handleFieldFocus("subject")}
                    onBlur={(e) => {
                      handleFieldBlur("subject");
                      // Store cursor position when losing focus
                      const target = e.target as HTMLInputElement;
                      setCursorPosition({
                        start: target.selectionStart ?? 0,
                        end: target.selectionEnd ?? 0
                      });
                    }}
                    onSelect={(e) => {
                      // Store cursor position on selection change
                      const target = e.target as HTMLInputElement;
                      setCursorPosition({
                        start: target.selectionStart ?? 0,
                        end: target.selectionEnd ?? 0
                      });
                    }}
                    onClick={(e) => {
                      // Store cursor position on click
                      const target = e.target as HTMLInputElement;
                      setCursorPosition({
                        start: target.selectionStart ?? 0,
                        end: target.selectionEnd ?? 0
                      });
                    }}
                    onKeyUp={(e) => {
                      // Store cursor position on key press
                      const target = e.target as HTMLInputElement;
                      setCursorPosition({
                        start: target.selectionStart ?? 0,
                        end: target.selectionEnd ?? 0
                      });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                    placeholder="e.g., Certification Review Assignment - ${CERTIFICATION_NAME}!"
                  />
                </div>
              </div>

              {/* Metadata Section */}
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Metadata</h3>
                  <p className="text-sm text-gray-500 mt-1">Optional tracking information</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Created By */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Created By <span className="text-xs text-gray-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.createdBy}
                      onChange={(e) => handleFieldChange("createdBy", e.target.value)}
                      onFocus={() => handleFieldFocus("createdBy")}
                      onBlur={() => handleFieldBlur("createdBy")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                      placeholder="e.g., admin"
                    />
                  </div>

                  {/* Updated By */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Updated By <span className="text-xs text-gray-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.updatedBy}
                      onChange={(e) => handleFieldChange("updatedBy", e.target.value)}
                      onFocus={() => handleFieldFocus("updatedBy")}
                      onBlur={() => handleFieldBlur("updatedBy")}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                      placeholder="e.g., admin"
                    />
                  </div>
                </div>
              </div>

              {/* Body Editor */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Body <span className="text-red-500">*</span>
                  </label>
                
                  {formData.templateType === "HTML" ? (
                    <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                      {/* Toolbar - Only show for HTML */}
                      <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleHtmlView}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            isHtmlView 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                          title="Toggle HTML Source"
                        >
                          {isHtmlView ? 'HTML Source' : 'Visual Editor'}
                        </button>
                        <div className="flex-1" />
                        <span className="text-xs text-gray-500">
                          {isHtmlView ? 'Edit HTML code directly' : 'Visual editing mode'}
                        </span>
                      </div>

                      {/* HTML Editor Content Area */}
                      {isHtmlView ? (
                        <textarea
                          ref={htmlSourceRef}
                          value={formData.body}
                          onChange={(e) => {
                            handleHtmlSourceChange(e.target.value);
                            // Track cursor position on change
                            const target = e.target as HTMLTextAreaElement;
                            setCursorPosition({
                              start: target.selectionStart,
                              end: target.selectionEnd
                            });
                          }}
                          onFocus={() => handleFieldFocus("body")}
                          onBlur={(e) => {
                            handleFieldBlur("body");
                            // Store cursor position when losing focus
                            const target = e.target as HTMLTextAreaElement;
                            setCursorPosition({
                              start: target.selectionStart,
                              end: target.selectionEnd
                            });
                          }}
                          onSelect={(e) => {
                            // Store cursor position on selection change
                            const target = e.target as HTMLTextAreaElement;
                            setCursorPosition({
                              start: target.selectionStart,
                              end: target.selectionEnd
                            });
                          }}
                          onClick={(e) => {
                            // Store cursor position on click
                            const target = e.target as HTMLTextAreaElement;
                            setCursorPosition({
                              start: target.selectionStart,
                              end: target.selectionEnd
                            });
                          }}
                          onKeyUp={(e) => {
                            // Store cursor position on key press
                            const target = e.target as HTMLTextAreaElement;
                            setCursorPosition({
                              start: target.selectionStart,
                              end: target.selectionEnd
                            });
                          }}
                          className="w-full min-h-[500px] p-4 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono bg-gray-50 text-gray-900 resize-none"
                          style={{ 
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            overflowWrap: 'normal',
                            overflowX: 'auto'
                          }}
                          spellCheck={false}
                        />
                      ) : (
                        <div
                          ref={editorRef}
                          contentEditable
                          onInput={(e) => {
                            const target = e.currentTarget;
                            handleFieldChange("body", target.innerHTML);
                          }}
                          onFocus={() => handleFieldFocus("body")}
                          onBlur={() => handleFieldBlur("body")}
                          className="min-h-[500px] p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                          style={{ whiteSpace: "pre-wrap" }}
                          suppressContentEditableWarning={true}
                        />
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={formData.body}
                      onChange={(e) => {
                        handleFieldChange("body", e.target.value);
                        // Track cursor position on change
                        const target = e.target as HTMLTextAreaElement;
                        setCursorPosition({
                          start: target.selectionStart,
                          end: target.selectionEnd
                        });
                      }}
                      onFocus={() => handleFieldFocus("body")}
                      onBlur={(e) => {
                        handleFieldBlur("body");
                        // Store cursor position when losing focus
                        const target = e.target as HTMLTextAreaElement;
                        setCursorPosition({
                          start: target.selectionStart,
                          end: target.selectionEnd
                        });
                      }}
                      onSelect={(e) => {
                        // Store cursor position on selection change
                        const target = e.target as HTMLTextAreaElement;
                        setCursorPosition({
                          start: target.selectionStart,
                          end: target.selectionEnd
                        });
                      }}
                      onClick={(e) => {
                        // Store cursor position on click
                        const target = e.target as HTMLTextAreaElement;
                        setCursorPosition({
                          start: target.selectionStart,
                          end: target.selectionEnd
                        });
                      }}
                      onKeyUp={(e) => {
                        // Store cursor position on key press
                        const target = e.target as HTMLTextAreaElement;
                        setCursorPosition({
                          start: target.selectionStart,
                          end: target.selectionEnd
                        });
                      }}
                      className="w-full min-h-[500px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white resize-none shadow-sm transition-all"
                      style={{ 
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap'
                      }}
                      placeholder="Enter plain text email body. You can use ${parameters} like ${userName}, ${resetLink}, etc."
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-10 pt-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Update Template
                  </button>
            </div>
          </div>
        </div>

        {/* Right Section - Parameters List */}
        <div className="w-80 flex-shrink-0 bg-white rounded-md shadow overflow-hidden flex flex-col" style={{ position: 'fixed', top: '84px', right: '24px', maxHeight: 'calc(100vh - 108px)', zIndex: 1000, width: '320px' }}>
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">Available Attributes</h3>
            </div>
            
            <div className="p-4 pt-6 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
              {attributesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading attributes...</span>
                </div>
              ) : attributesError ? (
                <div className="text-sm text-red-600 py-4 bg-red-50 p-3 rounded-md">{attributesError}</div>
              ) : attributes.length === 0 ? (
                <div className="text-sm text-gray-500 py-4">No attributes available</div>
              ) : (
                <div className="space-y-2">
                  {attributes.map((attribute, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => insertAttribute(attribute)}
                      className="w-full text-left px-3 py-2 text-xs font-mono bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-gray-200 rounded-md transition-colors group"
                      title={`Click to insert ${attribute}`}
                    >
                      <span className="text-gray-700 group-hover:text-blue-700">{attribute}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}

