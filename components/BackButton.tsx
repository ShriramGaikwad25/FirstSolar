'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /**
   * Custom text to display next to the back arrow
   * If not provided, defaults to "Back"
   */
  text?: string;
  /**
   * Custom CSS classes to apply to the button
   */
  className?: string;
  /**
   * Custom click handler. If not provided, uses router.back()
   */
  onClick?: () => void;
  /**
   * Whether to show the back arrow icon
   */
  showIcon?: boolean;
}

export function BackButton({ 
  text = "Back", 
  className = "", 
  onClick,
  showIcon = true 
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 
        bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 
        hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 
        focus:border-blue-500 transition-colors duration-200
        ${className}
      `}
      aria-label={`Go back to previous page`}
    >
      {showIcon && (
        <ArrowLeft className="w-4 h-4" />
      )}
      {text}
    </button>
  );
}


