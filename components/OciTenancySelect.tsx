"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import type { OciTenancy } from "@/types/oci-policy";

function tenancyOptionLabel(tenancy: OciTenancy): string {
  return tenancy.label?.trim() || tenancy.name?.trim() || tenancy.id;
}

export function OciTenancySelect({
  tenancies,
  value,
  onChange,
  displayLabel,
  disabled = false,
  isLoading = false,
  className = "",
}: {
  tenancies: OciTenancy[];
  value: string;
  onChange: (tenancyId: string) => void;
  displayLabel?: string | null;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}) {
  const resolvedDisplayLabel = displayLabel?.trim() || value.trim();
  const hasMatchingOption = tenancies.some((tenancy) => tenancy.id === value);
  const showDisplayOption =
    Boolean(resolvedDisplayLabel) && (!hasMatchingOption || tenancies.length === 0);
  const displayOptionValue = value || resolvedDisplayLabel;
  const hasOptions = tenancies.length > 0 || showDisplayOption;
  const isDisabled = disabled || (!hasOptions && !isLoading);

  const selectValue = hasMatchingOption
    ? value
    : showDisplayOption
      ? displayOptionValue
      : value || tenancies[0]?.id || "";

  return (
    <label className={`flex shrink-0 items-center gap-2 text-sm text-gray-700 ${className}`}>
      <span className="font-medium">Tenancy</span>
      <div className="relative">
        <select
          value={selectValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={isDisabled}
          className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm text-gray-900 min-w-[220px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
          aria-label="Select tenancy"
          aria-busy={isLoading}
        >
          {!hasOptions ? (
            <option value="">
              {isLoading ? "Loading tenancies…" : "No tenancies"}
            </option>
          ) : (
            <>
              {showDisplayOption ? (
                <option value={displayOptionValue}>{resolvedDisplayLabel}</option>
              ) : null}
              {tenancies.map((tenancy) => (
                <option key={tenancy.id} value={tenancy.id}>
                  {tenancyOptionLabel(tenancy)}
                </option>
              ))}
            </>
          )}
        </select>
        {isLoading ? (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        )}
      </div>
    </label>
  );
}
