'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;
  showPageLoader: (message?: string) => void;
  hidePageLoader: () => void;
  showApiLoader: (message?: string) => void;
  hideApiLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const setLoading = useCallback((loading: boolean, message: string = 'Loading...') => {
    setIsLoading(loading);
    setLoadingMessage(message);
  }, []);

  const showPageLoader = useCallback((message: string = 'Loading page...') => {
    setLoading(true, message);
  }, [setLoading]);

  const hidePageLoader = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  const showApiLoader = useCallback((message: string = 'Loading data...') => {
    setLoading(true, message);
  }, [setLoading]);

  const hideApiLoader = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  const value: LoadingContextType = {
    isLoading,
    loadingMessage,
    setLoading,
    showPageLoader,
    hidePageLoader,
    showApiLoader,
    hideApiLoader,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
