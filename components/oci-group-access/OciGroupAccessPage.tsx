"use client";

import { Loader2, Users, WifiOff } from "lucide-react";
import { OciGroupAccessTable } from "@/components/oci-group-access/OciGroupAccessTable";
import { useOciGroupAccessList } from "@/hooks/useOciGroupAccess";
import { defaultOciTenancy } from "@/lib/oci-tenancy-metadata";

export default function OciGroupAccessPage() {
  const tenancyId = defaultOciTenancy().id;
  const { data, isLoading, isError, error } = useOciGroupAccessList(tenancyId);

  const groups = data?.groups ?? [];
  const configured = data?.configured ?? false;

  return (
    <div className="w-full min-w-0 pb-8">
      <header className="mb-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Group Access</h1>
            <p className="mt-1 text-sm text-gray-600">
              Review which groups can access OCI resources across your tenancy.
            </p>
          </div>
        </div>
      </header>

      {!configured && !isLoading && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Sign in to load groups from KeyForge.</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading group access…
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : "Failed to load group access"}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Groups{" "}
              <span className="font-normal text-gray-500">({groups.length.toLocaleString()})</span>
            </h2>
          </div>

          {groups.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-600">No groups returned from the access API.</p>
          ) : (
            <OciGroupAccessTable groups={groups} />
          )}
        </div>
      )}
    </div>
  );
}
