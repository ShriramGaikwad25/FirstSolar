import { useState } from 'react';
import { useLoading } from '@/contexts/LoadingContext';

interface UseActionButtonOptions {
  onSuccess?: () => void;
  onError?: (error: any) => void;
  showToast?: boolean;
  toastMessage?: string;
  toastMessages?: string[];
  loaderDuration?: number;
}

export const useActionButton = (options: UseActionButtonOptions = {}) => {
  const {
    onSuccess,
    onError,
    showToast = true,
    toastMessage = 'Action completed',
    toastMessages = ['Action success', 'Action completed'],
    loaderDuration = 1000
  } = options;

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const { showApiLoader, hideApiLoader } = useLoading();

  const executeAction = async (
    actionName: string,
    actionFunction: () => Promise<any> | any
  ) => {
    try {
      setIsActionLoading(true);
      
      // Execute the action function
      await actionFunction();
      
      // End local loading state quickly (no overlay)
      setTimeout(() => {
        setIsActionLoading(false);
      }, 100);
      
      // Show completion message after 2 seconds if enabled
      if (showToast) {
        setTimeout(() => {
          setShowCompletionToast(true);
        }, 2000);
      }
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error(`Error performing ${actionName}:`, error);
      setIsActionLoading(false);
      
      // Call error callback
      if (onError) {
        onError(error);
      }
    }
  };

  const createActionHandler = (actionName: string, actionFunction: () => Promise<any> | any) => {
    return () => executeAction(actionName, actionFunction);
  };

  const closeToast = () => {
    setShowCompletionToast(false);
  };

  return {
    isActionLoading,
    showCompletionToast,
    executeAction,
    createActionHandler,
    closeToast,
    toastMessage,
    toastMessages
  };
};

export default useActionButton;
