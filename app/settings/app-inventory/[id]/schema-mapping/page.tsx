"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SchemaMappingTab from "../components/SchemaMappingTab";

export default function SchemaMappingPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = (params?.id as string) ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Schema Mapping</h1>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto w-full">
        <SchemaMappingTab
          applicationId={applicationId}
          onCancel={() => router.push("/settings/app-inventory")}
        />
      </div>
    </div>
  );
}
