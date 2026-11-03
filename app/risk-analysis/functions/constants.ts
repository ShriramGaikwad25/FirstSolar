import { useMemo } from "react";
import { useLookup } from "@/hooks/useLookup";

/** Fallback when the `SYSTEM_TYPE` lookup is empty or still loading. */
export const FUNCTION_SYSTEMS = [
  "FUSION",
  "SAP",
  "EBS",
  "DYNAMICS",
  "SALESFORCE",
  "PEOPLESOFT",
  "GENERIC",
] as const;

/**
 * System types from the `SYSTEM_TYPE` lookup (as KeyForge RM does), falling back to {@link FUNCTION_SYSTEMS}.
 * `current` is appended when missing so an existing function's system still shows in the select.
 */
export function useFunctionSystems(current?: string): string[] {
  const lookup = useLookup("SYSTEM_TYPE");
  return useMemo(() => {
    const codes = lookup.data?.length ? lookup.data.map((v) => v.value_code) : [...FUNCTION_SYSTEMS];
    return current && !codes.includes(current) ? [...codes, current] : codes;
  }, [lookup.data, current]);
}
