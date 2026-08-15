'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-blue-600',
    white: 'text-white',
    gray: 'text-gray-600',
  };

  return (
    <div className={`inline-block ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

interface PageLoaderProps {
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-600 text-lg font-medium">{message}</p>
      </div>
    </div>
  );
};

interface InlineLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  message = 'Loading...',
  size = 'md',
}) => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex flex-col items-center space-y-3">
        <LoadingSpinner size={size} />
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
};

interface ButtonLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ButtonLoader: React.FC<ButtonLoaderProps> = ({
  loading,
  children,
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {loading && <LoadingSpinner size="sm" color="white" />}
      <span>{children}</span>
    </div>
  );
};
