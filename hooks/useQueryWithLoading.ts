'use client';

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";

interface UseQueryWithLoadingOptions<T> {
  queryKey: (string | number)[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  loadingMessage?: string;
}

export const useQueryWithLoading = <T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 1000 * 60 * 5,
  loadingMessage = 'Loading data...',
}: UseQueryWithLoadingOptions<T>): UseQueryResult<T> => {
  const { showApiLoader, hideApiLoader } = useLoading();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      showApiLoader(loadingMessage);
      try {
        return await queryFn();
      } finally {
        hideApiLoader();
      }
    },
    enabled,
    staleTime,
  });

  useEffect(() => {
    if (query.isLoading) {
      showApiLoader(loadingMessage);
    } else {
      hideApiLoader();
    }
  }, [query.isLoading, showApiLoader, hideApiLoader, loadingMessage]);

  return query;
};
