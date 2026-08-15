"use client";

import { useQuery } from "@tanstack/react-query";
import {
  COMPARTMENTS_API_URL,
  fetchCompartmentsTree,
  isCompartmentsApiConfigured,
} from "@/lib/compartments-api";
import type { CompartmentsTreeResult } from "@/types/oci-compartments";

export type CompartmentsTreeResponse = CompartmentsTreeResult & {
  configured: boolean;
};

async function fetchCompartments(): Promise<CompartmentsTreeResponse> {
  const result = await fetchCompartmentsTree();
  return {
    configured: isCompartmentsApiConfigured(),
    ...result,
  };
}

export function useOciCompartmentsTree() {
  return useQuery({
    queryKey: ["oci-compartments-tree", COMPARTMENTS_API_URL],
    queryFn: fetchCompartments,
    staleTime: 30_000,
  });
}
