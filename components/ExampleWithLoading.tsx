'use client';

import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { useQueryWithLoading } from '@/hooks/useQueryWithLoading';
import { getCertifications } from '@/lib/api';
import { LoadingSpinner, InlineLoader, ButtonLoader } from './LoadingSpinner';

interface ExampleWithLoadingProps {
  reviewerId: string;
}

export const ExampleWithLoading: React.FC<ExampleWithLoadingProps> = ({ reviewerId }) => {
  const { showPageLoader, hidePageLoader, showApiLoader, hideApiLoader } = useLoading();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Example 1: Using the enhanced query hook with loading
  const { data: certifications, isLoading, error } = useQueryWithLoading({
    queryKey: ['certifications', reviewerId],
    queryFn: () => getCertifications(reviewerId),
    loadingMessage: 'Loading certifications...',
  });

  // Example 2: Manual loading control
  const handleManualApiCall = async () => {
    try {
      showApiLoader('Processing request...');
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('API call completed');
    } finally {
      hideApiLoader();
    }
  };

  // Example 3: Page loading
  const handlePageAction = async () => {
    try {
      showPageLoader('Processing page action...');
      // Simulate page action
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      hidePageLoader();
    }
  };

  // Example 4: Button loading
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Simulate form submission
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Form submitted');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <InlineLoader message="Loading certifications..." />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">Error loading data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Loading Examples</h2>
      
      {/* Example 1: Data display */}
      <div className="p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium mb-2">Certifications ({certifications?.items?.length || 0})</h3>
        {certifications?.items?.map((cert: any, index: number) => (
          <div key={index} className="text-sm text-gray-600">
            {cert.certificationName || `Certification ${index + 1}`}
          </div>
        ))}
      </div>

      {/* Example 2: Manual API loading */}
      <button
        onClick={handleManualApiCall}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Manual API Call
      </button>

      {/* Example 3: Page loading */}
      <button
        onClick={handlePageAction}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        Page Action
      </button>

      {/* Example 4: Button loading */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
      >
        <ButtonLoader loading={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Form'}
        </ButtonLoader>
      </button>

      {/* Example 5: Inline spinner */}
      <div className="flex items-center space-x-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-gray-600">Processing...</span>
      </div>
    </div>
  );
};
