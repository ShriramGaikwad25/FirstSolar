"use client";
import React, { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { useItemDetails } from "@/contexts/ItemDetailsContext";
import { Calendar, Edit, Save, X, Paperclip, ChevronDown, ChevronUp } from "lucide-react";

const getTodayDateString = () => new Date().toISOString().split("T")[0];

interface ItemDates {
  [itemId: string]: {
    startDate: string;
    endDate: string;
    isIndefinite: boolean;
    comment: string;
    isEditing: boolean;
    useGlobalSettings: boolean;
  };
}

const DetailsTab: React.FC = () => {
  const { items } = useCart();
  const { 
    setItemDetail, 
    getItemDetail, 
    globalSettings, 
    setGlobalSettings,
    attachmentFileByItem,
    setAttachmentFile,
    requestType,
    setRequestType,
  } = useItemDetails();
  const [itemDates, setItemDates] = useState<ItemDates>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const initializedItemsRef = React.useRef<Set<string>>(new Set());
  const prevGlobalSettingsRef = React.useRef(globalSettings);

  // Initialize dates for new items only
  React.useEffect(() => {
    const itemIds = new Set(items.map(item => item.id));
    const newItems = items.filter(item => !initializedItemsRef.current.has(item.id));
    
    if (newItems.length === 0) return;

    setItemDates((prev) => {
      const newDates: ItemDates = { ...prev };
      newItems.forEach((item) => {
        const existingDetail = getItemDetail(item.id);
        const useGlobal = existingDetail?.useGlobalSettings ?? true;

        const isIndefinite =
          existingDetail?.isIndefinite ?? globalSettings.isIndefinite;

        newDates[item.id] = {
          startDate:
            existingDetail?.startDate || globalSettings.startDate,
          endDate:
            existingDetail?.endDate ||
            (isIndefinite ? "" : globalSettings.endDate),
          isIndefinite,
          comment: existingDetail?.comment || globalSettings.comment,
          isEditing: false,
          useGlobalSettings: useGlobal,
        };

        initializedItemsRef.current.add(item.id);
      });
      return newDates;
    });

    // Sync new items to context
    newItems.forEach((item) => {
      const existingDetail = getItemDetail(item.id);
      const useGlobal = existingDetail?.useGlobalSettings ?? true;
      const isIndefinite =
        existingDetail?.isIndefinite ?? globalSettings.isIndefinite;
      setItemDetail(item.id, {
        startDate:
          existingDetail?.startDate || globalSettings.startDate,
        endDate:
          existingDetail?.endDate ||
          (isIndefinite ? "" : globalSettings.endDate),
        isIndefinite,
        comment: existingDetail?.comment || globalSettings.comment,
        useGlobalSettings: useGlobal,
      });
    });
  }, [items.map(item => item.id).join(','), getItemDetail, setItemDetail, globalSettings.startDate, globalSettings.endDate, globalSettings.isIndefinite, globalSettings.comment]);

  // Clean up removed items
  React.useEffect(() => {
    const currentItemIds = new Set(items.map(item => item.id));
    initializedItemsRef.current.forEach(itemId => {
      if (!currentItemIds.has(itemId)) {
        initializedItemsRef.current.delete(itemId);
      }
    });
  }, [items.map(item => item.id).join(',')]);

  // Update items when global settings change (only if they use global settings)
  useEffect(() => {
    const globalChanged =
      prevGlobalSettingsRef.current.startDate !== globalSettings.startDate ||
      prevGlobalSettingsRef.current.endDate !== globalSettings.endDate ||
      prevGlobalSettingsRef.current.isIndefinite !== globalSettings.isIndefinite ||
      prevGlobalSettingsRef.current.comment !== globalSettings.comment;

    if (!globalChanged) {
      prevGlobalSettingsRef.current = globalSettings;
      return;
    }

    prevGlobalSettingsRef.current = globalSettings;

    items.forEach((item) => {
      const detail = getItemDetail(item.id);
      if (detail?.useGlobalSettings) {
        setItemDates((prev) => {
          const current = prev[item.id];
          const targetStartDate = globalSettings.startDate;
          const targetEndDate = globalSettings.isIndefinite
            ? ""
            : globalSettings.endDate;

          // Only update if values actually changed
          if (
            current &&
            current.startDate === targetStartDate &&
            current.endDate === targetEndDate &&
            current.isIndefinite === globalSettings.isIndefinite &&
            current.comment === globalSettings.comment
          ) {
            return prev;
          }

          return {
            ...prev,
            [item.id]: {
              ...prev[item.id],
              startDate: targetStartDate,
              endDate: targetEndDate,
              isIndefinite: globalSettings.isIndefinite,
              comment: globalSettings.comment,
            },
          };
        });

        setItemDetail(item.id, {
          startDate: globalSettings.startDate,
          endDate: globalSettings.isIndefinite ? "" : globalSettings.endDate,
          isIndefinite: globalSettings.isIndefinite,
          comment: globalSettings.comment,
          useGlobalSettings: true,
        });
      }
    });
  }, [globalSettings.startDate, globalSettings.endDate, globalSettings.isIndefinite, globalSettings.comment, items.map(item => item.id).join(','), getItemDetail, setItemDetail]);

  const handleGlobalDateChange = (field: "startDate" | "endDate", value: string) => {
    setGlobalSettings({
      [field]: value,
    });
  };

  const handleGlobalAccessTypeChange = (type: "indefinite" | "duration") => {
    if (type === "indefinite") {
      setGlobalSettings({
        accessType: type,
        isIndefinite: true,
        startDate: getTodayDateString(),
        endDate: "",
      });
    } else {
      setGlobalSettings({
        accessType: type,
        isIndefinite: false,
      });
    }
  };

  const handleGlobalCommentChange = (value: string) => {
    setGlobalSettings({
      comment: value,
    });
  };

  const handleDateChange = (itemId: string, field: "startDate" | "endDate", value: string) => {
    setItemDates((prev) => {
      const updated = {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: value,
          useGlobalSettings: false, // Mark as custom when user changes
        },
      };
      
      return updated;
    });
    
    // Sync with context after state update
    setTimeout(() => {
      setItemDetail(itemId, {
        [field]: value,
        useGlobalSettings: false,
      });
    }, 0);
  };

  const handleItemAccessTypeChange = (
    itemId: string,
    type: "indefinite" | "duration"
  ) => {
    const isIndefinite = type === "indefinite";
    const today = getTodayDateString();

    setItemDates((prev) => {
      const updated = {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          isIndefinite,
          startDate: isIndefinite ? today : prev[itemId]?.startDate,
          endDate: isIndefinite ? "" : prev[itemId]?.endDate,
          useGlobalSettings: false, // Mark as custom when user changes
        },
      };

      return updated;
    });

    // Sync with context after state update
    setTimeout(() => {
      setItemDetail(itemId, {
        isIndefinite,
        startDate: isIndefinite ? today : undefined,
        endDate: isIndefinite ? "" : undefined,
        useGlobalSettings: false,
      });
    }, 0);
  };


  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No items selected. Please go back to step 2 to select access roles.
      </div>
    );
  }

  const globalIsIndefinite = globalSettings.isIndefinite;

  return (
    <div className="w-full">
      {/* Global Access Duration and Comments Section */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Access Duration & Comments</h3>
        
        <div className="space-y-4">
          {/* Access Type, Request Type, Start Date, End Date - all in one row, same height */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="relative flex flex-col min-h-[72px]">
              <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                Access Type
              </label>
              <div className="flex-1 min-h-[42px] flex items-center p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <span 
                    className={`text-sm font-medium cursor-pointer ${
                      globalIsIndefinite ? "text-blue-600 font-semibold" : "text-gray-600"
                    }`}
                    onClick={() => handleGlobalAccessTypeChange("indefinite")}
                  >
                    Indefinite
                  </span>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!globalIsIndefinite}
                      onChange={(e) => handleGlobalAccessTypeChange(e.target.checked ? "duration" : "indefinite")}
                    />
                    <div className="absolute w-full h-full bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-all"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all peer-checked:translate-x-6"></div>
                  </label>
                  <span 
                    className={`text-sm font-medium cursor-pointer ${
                      !globalIsIndefinite ? "text-blue-600 font-semibold" : "text-gray-600"
                    }`}
                    onClick={() => handleGlobalAccessTypeChange("duration")}
                  >
                    Duration
                  </span>
                </div>
              </div>
            </div>
            <div className="relative flex flex-col min-h-[72px]">
              <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                Request Type
              </label>
              <div className="flex-1 min-h-[42px] flex items-center p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium cursor-pointer ${
                      requestType === "Regular" ? "text-blue-600 font-semibold" : "text-gray-600"
                    }`}
                    onClick={() => setRequestType("Regular")}
                  >
                    Regular
                  </span>
                  <label className="relative inline-block w-12 h-6 cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={requestType === "Urgent"}
                      onChange={(e) => setRequestType(e.target.checked ? "Urgent" : "Regular")}
                    />
                    <div className="absolute w-full h-full bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-all" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all peer-checked:translate-x-6" />
                  </label>
                  <span
                    className={`text-sm font-medium cursor-pointer ${
                      requestType === "Urgent" ? "text-blue-600 font-semibold" : "text-gray-600"
                    }`}
                    onClick={() => setRequestType("Urgent")}
                  >
                    Urgent
                  </span>
                </div>
              </div>
            </div>
            <div className="relative flex flex-col min-h-[72px]">
              <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                Start Date
              </label>
              <div className="flex-1 min-h-[42px] flex items-center">
                <div className="relative w-full">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="date"
                    value={globalSettings.startDate}
                    onChange={(e) => handleGlobalDateChange("startDate", e.target.value)}
                    disabled={globalIsIndefinite}
                    className={`w-full h-[42px] pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${globalIsIndefinite ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
            </div>
            <div className="relative flex flex-col min-h-[72px]">
              <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                End Date
              </label>
              <div className="flex-1 min-h-[42px] flex items-center">
                <div className="relative w-full">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="date"
                    value={globalSettings.endDate}
                    onChange={(e) => handleGlobalDateChange("endDate", e.target.value)}
                    min={globalSettings.startDate}
                    disabled={globalIsIndefinite}
                    className={`w-full h-[42px] pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${globalIsIndefinite ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Global Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments
            </label>
            <textarea
              value={globalSettings.comment}
              onChange={(e) => handleGlobalCommentChange(e.target.value)}
              placeholder="Enter comments that will apply to all access items..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
          </div>
        </div>
      </div>

      {/* Items with Date Fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Access Items</h3>
        {items.map((item) => {
          const dates = itemDates[item.id] || {
            startDate: globalSettings.startDate,
            endDate: globalSettings.endDate,
            isIndefinite: globalSettings.isIndefinite,
            comment: globalSettings.comment,
            isEditing: false,
            useGlobalSettings: true,
          };
          
          const isIndefinite = dates.isIndefinite;
          const useGlobal = dates.useGlobalSettings;
          
          const handleEdit = () => {
            setItemDates((prev) => ({
              ...prev,
              [item.id]: {
                ...prev[item.id],
                isEditing: true,
              },
            }));
          };
          
          const handleSave = () => {
            setItemDates((prev) => {
              const updated = {
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  isEditing: false,
                },
              };
              
              return updated;
            });
            
            // Sync with context after state update
            setTimeout(() => {
              const current = itemDates[item.id];
              if (current) {
                setItemDetail(item.id, {
                  comment: current.comment,
                });
              }
            }, 0);
          };
          
          const handleCancel = () => {
            setItemDates((prev) => {
              const existing = getItemDetail(item.id);
              return {
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  isEditing: false,
                  comment: existing?.comment || globalSettings.comment,
                },
              };
            });
          };
          
          const handleCommentChange = (value: string) => {
            setItemDates((prev) => {
              const updated = {
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  comment: value,
                  useGlobalSettings: false, // Mark as custom when user changes
                },
              };
              
              return updated;
            });
            
            // Sync with context after state update
            setTimeout(() => {
              setItemDetail(item.id, {
                comment: value,
                useGlobalSettings: false,
              });
            }, 0);
          };

          const getRiskColor = (risk?: "High" | "Medium" | "Low") => {
            switch (risk) {
              case "High":
                return "bg-red-100 text-red-700 border-red-200";
              case "Medium":
                return "bg-orange-100 text-orange-700 border-orange-200";
              case "Low":
                return "bg-green-100 text-green-700 border-green-200";
              default:
                return "bg-gray-100 text-gray-700 border-gray-200";
            }
          };

          const isExpanded = expandedItems.has(item.id);
          const toggleExpanded = () => {
            setExpandedItems((prev) => {
              const next = new Set(prev);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          };

          return (
            <div
              key={item.id}
              className={`border rounded-lg transition-colors overflow-hidden ${
                useGlobal 
                  ? "border-blue-200 bg-blue-50/30" 
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={toggleExpanded}
                className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50/50 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
                  {item.risk && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${getRiskColor(item.risk)}`}>
                      {item.risk} Risk
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-gray-500" aria-hidden>
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>

              {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                <div className="mb-3">
                {/* Access Type Toggle, Start Date, and End Date in same row */}
                <div className={`grid gap-3 items-end ${!isIndefinite ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
                  {/* Access Type Toggle */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Access Type
                    </label>
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span 
                          className={`text-xs font-medium cursor-pointer ${
                            isIndefinite ? "text-blue-600 font-semibold" : "text-gray-600"
                          }`}
                          onClick={() => handleItemAccessTypeChange(item.id, "indefinite")}
                        >
                          Indefinite
                        </span>
                        
                        <label className="relative inline-block w-10 h-5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!isIndefinite}
                            onChange={(e) => handleItemAccessTypeChange(item.id, e.target.checked ? "duration" : "indefinite")}
                          />
                          <div className="absolute w-full h-full bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-all"></div>
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all peer-checked:translate-x-5"></div>
                        </label>
                        
                        <span 
                          className={`text-xs font-medium cursor-pointer ${
                            !isIndefinite ? "text-blue-600 font-semibold" : "text-gray-600"
                          }`}
                          onClick={() => handleItemAccessTypeChange(item.id, "duration")}
                        >
                          Duration
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Start Date - Only show when Duration */}
                  {!isIndefinite && (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                          type="date"
                          value={dates.startDate}
                          onChange={(e) => handleDateChange(item.id, "startDate", e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* End Date - Only show when Duration */}
                  {!isIndefinite && (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                          type="date"
                          value={dates.endDate}
                          onChange={(e) => handleDateChange(item.id, "endDate", e.target.value)}
                          min={dates.startDate}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Comment & Attachments */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Comment
                </label>
                {dates.isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={dates.comment}
                      onChange={(e) => handleCommentChange(e.target.value)}
                      placeholder="Enter comment..."
                      rows={3}
                      className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[80px]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors text-xs"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md font-medium transition-colors text-xs"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full min-w-0">
                    {/* Half row: Comment */}
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="flex-1 min-w-0 min-h-[52px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50">
                        {dates.comment ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{dates.comment}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No comment added</p>
                        )}
                      </div>
                      <button
                        onClick={handleEdit}
                        className="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-medium transition-colors text-xs shrink-0"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                    </div>
                    {/* Half row: Attachment */}
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <div className="relative shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const input = fileInputRefs.current[item.id];
                            if (input) {
                              input.value = "";
                              input.click();
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 hover:text-indigo-800 hover:border-indigo-300 transition-colors text-sm font-medium"
                          title="Attach file (XLS, PDF, JPEG/PNG)"
                          aria-label="Attach file"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span>Attachment</span>
                        </button>
                        {!attachmentFileByItem[item.id] && (
                          <span className="text-xs text-gray-500">
                            File types supported - XLS, PDF, JPEG/PNG. Max file size of 2 MB
                          </span>
                        )}
                      </div>
                      <input
                        type="file"
                        ref={(el) => {
                          if (el) fileInputRefs.current[item.id] = el;
                        }}
                        className="hidden"
                        accept=".xls,.xlsx,.pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setAttachmentFile(item.id, file.name);
                        }}
                      />
                      {attachmentFileByItem[item.id] && (
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md max-w-full min-w-0">
                            <span className="truncate" title={attachmentFileByItem[item.id]}>
                              File: {attachmentFileByItem[item.id]}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttachmentFile(item.id, "")}
                              className="p-0.5 rounded hover:bg-emerald-100 text-emerald-600 shrink-0"
                              aria-label="Remove file"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DetailsTab;
