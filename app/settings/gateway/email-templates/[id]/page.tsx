"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mail, Calendar, User, FileText, Edit } from "lucide-react";
import { resolveTenantIdForHeader, getJwtAuthHeaders } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize-html";

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

function MetaField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
        <div className="mt-0.5 truncate text-sm text-gray-900">{value}</div>
      </div>
    </div>
  );
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
          `https://preview.keyforge.ai/kfmailserver/templates/api/v1/${resolveTenantIdForHeader()}/getall`,
          { headers: getJwtAuthHeaders() }
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
    <div className="h-full">
      <div className="w-full px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {template ? template.templateName : "Email Template Details"}
              </h1>
              {template && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    template.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {template.active ? "Active" : "Inactive"}
                </span>
              )}
            </div>
            {template?.description && (
              <p className="text-sm text-gray-500 mt-1 max-w-3xl">{template.description}</p>
            )}
          </div>
          {template && (
            <button
              type="button"
              onClick={() => router.push(`/settings/gateway/email-templates/edit/${template.id}`)}
              className="shrink-0 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm text-gray-500">Loading template details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-medium">Error loading template</p>
                <p className="mt-0.5 text-xs">{error}</p>
              </div>
            </div>
          ) : template ? (
            <div className="p-6 space-y-6">
              <div className="pb-6 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Parameters
                </h2>
                {template.parameters && template.parameters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {template.parameters.map((param, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800"
                      >
                        {param}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No parameters available</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pb-6 border-b border-gray-200">
                <MetaField icon={Calendar} label="Created At" value={formatDate(template.createdAt)} />
                <MetaField icon={Calendar} label="Updated At" value={formatDate(template.updatedAt)} />
                <MetaField icon={User} label="Created By" value={template.createdBy || "-"} />
                <MetaField icon={User} label="Updated By" value={template.updatedBy || "-"} />
              </div>

              <div className="pb-6 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Subject
                </h2>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {template.subject || "-"}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Body
                </h2>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[600px] overflow-y-auto">
                  {template.body ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(template.body) }}
                      className="prose prose-sm max-w-none"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">No body content available</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <Mail className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Template not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
