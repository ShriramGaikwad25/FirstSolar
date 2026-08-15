'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle } from 'lucide-react';

interface ActionCompletedToastProps {
  isVisible: boolean;
  message?: string;
  messages?: string[];
  onClose: () => void;
  duration?: number;
  messageDuration?: number;
}

export const ActionCompletedToast: React.FC<ActionCompletedToastProps> = ({
  isVisible,
  message = 'Action completed',
  messages = [],
  onClose,
  duration = 2000,
  messageDuration = 1000,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setCurrentMessageIndex(0);
      
      // If messages array is provided, use it; otherwise use single message
      const messageList = messages.length > 0 ? messages : [message];
      setCurrentMessage(messageList[0]);
      
      let messageTimer: NodeJS.Timeout;
      let closeTimer: NodeJS.Timeout;
      
      if (messageList.length > 1) {
        // Show messages in sequence
        let messageIndex = 0;
        const showNextMessage = () => {
          messageIndex++;
          if (messageIndex < messageList.length) {
            setCurrentMessage(messageList[messageIndex]);
            setCurrentMessageIndex(messageIndex);
            messageTimer = setTimeout(showNextMessage, messageDuration);
          } else {
            // All messages shown, start close timer
            closeTimer = setTimeout(() => {
              setShouldRender(false);
              setTimeout(onClose, 300); // Allow fade out animation
            }, messageDuration);
          }
        };
        
        messageTimer = setTimeout(showNextMessage, messageDuration);
      } else {
        // Single message
        closeTimer = setTimeout(() => {
          setShouldRender(false);
          setTimeout(onClose, 300); // Allow fade out animation
        }, duration);
      }

      return () => {
        if (messageTimer) clearTimeout(messageTimer);
        if (closeTimer) clearTimeout(closeTimer);
      };
    }
  }, [isVisible, duration, messageDuration, onClose, message, messages]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[200px]">
        <CheckCircle className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{currentMessage}</span>
      </div>
    </div>,
    document.body
  );
};

export default ActionCompletedToast;
