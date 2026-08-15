'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface ItemDetail {
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  comment: string;
  globalAccessType: 'indefinite' | 'duration';
  useGlobalSettings?: boolean; // Flag to indicate if item uses global settings
}

interface GlobalSettings {
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
  comment: string;
  accessType: 'indefinite' | 'duration';
}

interface ItemDetailsContextType {
  itemDetails: Record<string, ItemDetail>;
  setItemDetail: (itemId: string, detail: Partial<ItemDetail>) => void;
  setGlobalAccessType: (type: 'indefinite' | 'duration') => void;
  getItemDetail: (itemId: string) => ItemDetail | undefined;
  globalAccessType: 'indefinite' | 'duration';
  globalSettings: GlobalSettings;
  setGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  applyGlobalToAll: () => void;
  clearItemDetails: () => void;
  attachmentEmailByItem: Record<string, string>;
  attachmentFileByItem: Record<string, string>;
  setAttachmentEmail: (itemId: string, email: string) => void;
  setAttachmentFile: (itemId: string, fileName: string) => void;
  requestType: 'Regular' | 'Urgent';
  setRequestType: (type: 'Regular' | 'Urgent') => void;
}

const ItemDetailsContext = createContext<ItemDetailsContextType | undefined>(undefined);

const getDefaultDates = () => {
  const today = new Date().toISOString().split("T")[0];
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const defaultEndDate = oneYearLater.toISOString().split("T")[0];
  return { today, defaultEndDate };
};

export function ItemDetailsProvider({ children }: { children: ReactNode }) {
  const [itemDetails, setItemDetails] = useState<Record<string, ItemDetail>>({});
  const [attachmentEmailByItem, setAttachmentEmailByItemState] = useState<Record<string, string>>({});
  const [attachmentFileByItem, setAttachmentFileByItemState] = useState<Record<string, string>>({});
  const [globalAccessType, setGlobalAccessTypeState] = useState<'indefinite' | 'duration'>('duration');
  const [requestType, setRequestTypeState] = useState<'Regular' | 'Urgent'>('Regular');
  
  const { today, defaultEndDate } = getDefaultDates();
  
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>(() => {
    const { today, defaultEndDate } = getDefaultDates();
    return {
      startDate: today,
      endDate: defaultEndDate,
      isIndefinite: false,
      comment: "",
      accessType: 'duration',
    };
  });

  const setItemDetail = useCallback((itemId: string, detail: Partial<ItemDetail>) => {
    setItemDetails((prev) => {
      const existing = prev[itemId];
      const useGlobal = detail.useGlobalSettings !== undefined ? detail.useGlobalSettings : (existing?.useGlobalSettings ?? true);
      
      // If using global settings, merge with global values
      const baseDetail = useGlobal ? {
        startDate: globalSettings.startDate,
        endDate: globalSettings.endDate,
        isIndefinite: globalSettings.isIndefinite,
        comment: globalSettings.comment,
        globalAccessType: globalSettings.accessType,
      } : {
        startDate: existing?.startDate || detail.startDate || getDefaultDates().today,
        endDate: existing?.endDate || detail.endDate || getDefaultDates().defaultEndDate,
        isIndefinite: detail.isIndefinite !== undefined ? detail.isIndefinite : (existing?.isIndefinite ?? false),
        comment: detail.comment !== undefined ? detail.comment : (existing?.comment || ""),
        globalAccessType: existing?.globalAccessType || globalAccessType,
      };
      
      return {
        ...prev,
        [itemId]: {
          ...baseDetail,
          ...detail,
          useGlobalSettings: useGlobal,
        } as ItemDetail,
      };
    });
  }, [globalAccessType, globalSettings]);

  const setGlobalAccessType = useCallback((type: 'indefinite' | 'duration') => {
    setGlobalAccessTypeState(type);
    setGlobalSettingsState((prev) => ({
      ...prev,
      accessType: type,
      isIndefinite: type === 'indefinite',
    }));
  }, []);

  const setGlobalSettings = useCallback((settings: Partial<GlobalSettings>) => {
    setGlobalSettingsState((prev) => ({
      ...prev,
      ...settings,
    }));
  }, []);

  const applyGlobalToAll = useCallback(() => {
    setItemDetails((prev) => {
      const updated: Record<string, ItemDetail> = {};
      Object.keys(prev).forEach((itemId) => {
        updated[itemId] = {
          ...prev[itemId],
          startDate: globalSettings.startDate,
          endDate: globalSettings.endDate,
          isIndefinite: globalSettings.isIndefinite,
          comment: globalSettings.comment,
          globalAccessType: globalSettings.accessType,
          useGlobalSettings: true,
        };
      });
      return updated;
    });
  }, [globalSettings]);

  const getItemDetail = useCallback((itemId: string) => {
    return itemDetails[itemId];
  }, [itemDetails]);

  const clearItemDetails = useCallback(() => {
    setItemDetails({});
    setAttachmentEmailByItemState({});
    setAttachmentFileByItemState({});
    setRequestTypeState('Regular');
    setGlobalAccessTypeState('duration');
    const { today, defaultEndDate } = getDefaultDates();
    setGlobalSettingsState({
      startDate: today,
      endDate: defaultEndDate,
      isIndefinite: false,
      comment: '',
      accessType: 'duration',
    });
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('accessRoleDetails:')) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setRequestType = useCallback((type: 'Regular' | 'Urgent') => {
    setRequestTypeState(type);
  }, []);

  const setAttachmentEmail = useCallback((itemId: string, email: string) => {
    setAttachmentEmailByItemState((prev) => ({ ...prev, [itemId]: email }));
  }, []);

  const setAttachmentFile = useCallback((itemId: string, fileName: string) => {
    setAttachmentFileByItemState((prev) => ({ ...prev, [itemId]: fileName }));
  }, []);

  const value = {
    itemDetails,
    setItemDetail,
    setGlobalAccessType,
    getItemDetail,
    globalAccessType,
    globalSettings,
    setGlobalSettings,
    applyGlobalToAll,
    clearItemDetails,
    attachmentEmailByItem,
    attachmentFileByItem,
    setAttachmentEmail,
    setAttachmentFile,
    requestType,
    setRequestType,
  };

  return <ItemDetailsContext.Provider value={value}>{children}</ItemDetailsContext.Provider>;
}

export function useItemDetails(): ItemDetailsContextType {
  const context = useContext(ItemDetailsContext);
  if (context === undefined) {
    throw new Error('useItemDetails must be used within an ItemDetailsProvider');
  }
  return context;
}

