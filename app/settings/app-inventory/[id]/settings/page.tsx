"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, FolderTree, Network, Sliders, Edit, Copy } from "lucide-react";
import { getApplicationDetails } from "@/lib/api";
import HorizontalTabs from "@/components/HorizontalTabs";
import ApplicationEditTab, {
  type ApplicationEditTabHandle,
} from "../components/ApplicationEditTab";
import SchemaMappingTab from "../components/SchemaMappingTab";
import AdvanceSettingTab from "../components/AdvanceSettingTab";
import OuAssignmentTab from "../components/OuAssignmentTab";
import CloneConnectorModal from "../components/CloneConnectorModal";

const TAB_EDIT = "configuration";
const TAB_OU = "ou-assignment";
const TAB_SCHEMA = "schema";
const TAB_ADVANCED = "advanced";

function buildTabIds(isAdDomain: boolean): string[] {
  return isAdDomain ? [TAB_EDIT, TAB_OU, TAB_SCHEMA, TAB_ADVANCED] : [TAB_EDIT, TAB_SCHEMA, TAB_ADVANCED];
}

function tabIdToIndex(tab: string, tabIds: string[]): number {
  const i = tabIds.indexOf(tab);
  return i >= 0 ? i : 0;
}

function indexToTabId(index: number, tabIds: string[]): string {
  return tabIds[Math.max(0, Math.min(index, tabIds.length - 1))];
}

export default function AppInventorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = (params?.id as string) ?? "";
  const [isAdDomain, setIsAdDomain] = useState(false);
  const tabIds = useMemo(() => buildTabIds(isAdDomain), [isAdDomain]);
  const tabFromUrl = searchParams.get("tab") ?? TAB_EDIT;
  const [activeTabIndex, setActiveTabIndex] = useState(() => tabIdToIndex(tabFromUrl, buildTabIds(false)));
  const [appName, setAppName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigEditing, setIsConfigEditing] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [pageToast, setPageToast] = useState<string | null>(null);
  const configTabRef = useRef<ApplicationEditTabHandle>(null);

  const showPageToast = (message: string) => {
    setPageToast(message);
    window.setTimeout(() => setPageToast(null), 3000);
  };

  useEffect(() => {
    setActiveTabIndex(tabIdToIndex(tabFromUrl, tabIds));
  }, [tabFromUrl, tabIds]);

  useEffect(() => {
    if (activeTabIndex !== 0) setIsConfigEditing(false);
  }, [activeTabIndex]);

  useEffect(() => {
    if (!applicationId) {
      setIsLoading(false);
      return;
    }
    const apiToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`app-inventory-token-${applicationId}`) ?? ""
        : "";
    getApplicationDetails(applicationId, apiToken)
      .then((data: any) => {
        const app = data?.Application ?? data;
        setAppName(
          app?.ApplicationName ?? app?.applicationName ?? app?.name ?? "Application Settings"
        );
        const category = String(
          app?.category ?? app?.Category ?? app?.applicationType ?? app?.ApplicationType ?? ""
        ).trim();
        setIsAdDomain(category === "Active Directory Domain");
      })
      .catch(() => setAppName("Application Settings"))
      .finally(() => setIsLoading(false));
  }, [applicationId]);

  const handleBack = () => {
    router.push("/settings/app-inventory");
  };

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index);
    const tab = indexToTabId(index, tabIds);
    router.replace(`/settings/app-inventory/${applicationId}/settings?tab=${tab}`, { scroll: false });
  };

  const tabsData = useMemo(() => {
    const EditTab = () => (
      <ApplicationEditTab
        ref={configTabRef}
        applicationId={applicationId}
        onBackToInventory={handleBack}
        isEditing={isConfigEditing}
        onEditingChange={setIsConfigEditing}
        hideToolbar
      />
    );
    const OuTab = () => <OuAssignmentTab appName={appName} onCancel={handleBack} />;
    const SchemaTab = () => (
      <SchemaMappingTab applicationId={applicationId} onCancel={handleBack} />
    );
    const AdvanceTab = () => (
      <AdvanceSettingTab
        applicationId={applicationId}
        showIntegrationAdvancedGroups
        onCancel={handleBack}
      />
    );
    return [
      { label: "Configuration ", component: EditTab, icon: Pencil },
      ...(isAdDomain ? [{ label: "OU Assignment", component: OuTab, icon: FolderTree }] : []),
      { label: "Schema Mapping", component: SchemaTab, icon: Network },
      { label: "Advance Setting", component: AdvanceTab, icon: Sliders },
    ];
  }, [applicationId, isConfigEditing, isAdDomain, appName]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Application Settings</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col w-full min-w-0">
      <div className="flex-1 flex flex-col min-h-0 w-full min-w-0 py-3 overflow-y-auto">
        <HorizontalTabs
          tabs={tabsData}
          defaultIndex={0}
          activeIndex={activeTabIndex}
          onChange={handleTabChange}
          headerActions={
            <div className="flex items-center gap-2">
              {isAdDomain && (
                <button
                  type="button"
                  onClick={() => setCloneModalOpen(true)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Copy className="w-4 h-4" aria-hidden />
                  Clone Connector
                </button>
              )}
              {activeTabIndex === 0 && (
                <>
                  {isConfigEditing ? (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
                        onClick={() => configTabRef.current?.cancelEdit()}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                        onClick={() => void configTabRef.current?.submit()}
                      >
                        Submit
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium"
                      onClick={() => configTabRef.current?.startEdit()}
                      aria-label="Edit Application"
                      title="Edit Application"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />
      </div>

      <CloneConnectorModal
        open={cloneModalOpen}
        sourceConnectorName={appName}
        onClose={() => setCloneModalOpen(false)}
        onCreated={(name) => {
          setCloneModalOpen(false);
          showPageToast(`Draft connector ${name} created`);
        }}
      />

      {pageToast && (
        <div className="fixed bottom-6 right-6 z-[110] rounded-lg bg-gray-900 text-white text-sm px-4 py-3 shadow-xl">
          {pageToast}
        </div>
      )}
    </div>
  );
}
