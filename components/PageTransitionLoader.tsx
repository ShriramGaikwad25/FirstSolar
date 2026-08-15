'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLoading } from '@/contexts/LoadingContext';
import { PageLoader } from './LoadingSpinner';

export const PageTransitionLoader = () => {
  const pathname = usePathname();
  const { isLoading, loadingMessage, hidePageLoader } = useLoading();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Show loader when navigation starts
    setIsNavigating(true);
    
    // Hide loader after a short delay to allow page to load
    const timer = setTimeout(() => {
      setIsNavigating(false);
      hidePageLoader();
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname, hidePageLoader]);

  // Show loader during navigation or when explicitly loading
  if (isNavigating || isLoading) {
    return <PageLoader message={loadingMessage} />;
  }

  return null;
};
