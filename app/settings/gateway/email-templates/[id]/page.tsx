"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mail, Calendar, User, FileText, Edit } from "lucide-react";

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

interface ApiResponse {
  success: boolean;
  message: string;
  data: EmailTemplate[];
  timestamp: string;
}

export default function EmailTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            setTemplate(foundTemplate);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Green Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 h-16 text-white" style={{ backgroundColor: '#27B973' }}>
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-semibold text-white">
            {template ? template.templateName : "Email Template Details"}
          </h1>
        </div>
        {template && (
          <button
            onClick={() => router.push(`/settings/gateway/email-templates/edit/${template.id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#27B973] rounded-md hover:bg-gray-100 transition-colors font-medium"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#27B973] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading template details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
                <p className="font-medium">Error loading template</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : template ? (
            <div className="p-6 space-y-6">
              {/* Parameters Section */}
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#27B973]" />
                  Parameters
                </h2>
                {template.parameters && template.parameters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {template.parameters.map((param, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-md"
                      >
                        {param}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No parameters available</p>
                )}
              </div>

              {/* Metadata Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-200 pb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Created At
                  </h3>
                  <p className="text-gray-900">{formatDate(template.createdAt)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Updated At
                  </h3>
                  <p className="text-gray-900">{formatDate(template.updatedAt)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Created By
                  </h3>
                  <p className="text-gray-900">{template.createdBy || "-"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Updated By
                  </h3>
                  <p className="text-gray-900">{template.updatedBy || "-"}</p>
                </div>
              </div>

              {/* Subject Section */}
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#27B973]" />
                  Subject
                </h2>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-200">
                  {template.subject || "-"}
                </p>
              </div>

              {/* Body Section */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#27B973]" />
                  Body
                </h2>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[600px] overflow-y-auto">
                  {template.body ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: template.body }}
                      className="prose prose-sm max-w-none"
                    />
                  ) : (
                    <p className="text-gray-500">No body content available</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Mail className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-400 text-base">Template not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

