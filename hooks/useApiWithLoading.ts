'use client';

import { useState, useCallback } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { fetchApi } from '@/lib/api';

export const useApiWithLoading = () => {
  const { showApiLoader, hideApiLoader } = useLoading();
  const [isLoading, setIsLoading] = useState(false);

  const executeApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    loadingMessage: string = 'Loading...'
  ): Promise<T> => {
    setIsLoading(true);
    showApiLoader(loadingMessage);
    
    try {
      const result = await apiCall();
      return result;
    } finally {
      setIsLoading(false);
      hideApiLoader();
    }
  }, [showApiLoader, hideApiLoader]);

  const fetchWithLoading = useCallback(async <T>(
    endpoint: string,
    pageSize?: number,
    pageNumber?: number,
    options: RequestInit = {},
    loadingMessage: string = 'Loading data...'
  ): Promise<T> => {
    return executeApiCall(
      () => fetchApi<T>(endpoint, pageSize, pageNumber, options),
      loadingMessage
    );
  }, [executeApiCall]);

  return {
    isLoading,
    executeApiCall,
    fetchWithLoading,
  };
};
