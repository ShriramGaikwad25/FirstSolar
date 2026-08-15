"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check, ChevronDown, Edit, Trash2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllSupportedApplicationTypesViaProxy, parseSupportedObjectsApplicationTypeItem, describeAdvancedSettingSlotValue, normalizeSupportedObjectsFieldArray, type SupportedAppTypeAdvancedParts } from "@/lib/api";
import { getCookie, COOKIE_NAMES, forceLogout, getCurrentUser } from "@/lib/auth";

interface FormData {
  step1: {
    applicationName: string;
    type: string;
    oauthType: string;
  };
  step2: {
    applicationName: string;
    description: string;
    trustedSource: boolean;
    technicalOwner: string;
    businessOwner: string;
  };
  step3: {
    // Dynamic fields based on application type
    [key: string]: any;
  };
  step4: {
    complianceRequirements: string[];
    securityControls: string[];
    monitoringEnabled: boolean;
  };
  step5: {
    backupFrequency: string;
    disasterRecovery: string;
    maintenanceWindow: string;
  };
  step6: {
    reviewNotes: string;
    approvalRequired: boolean;
    goLiveDate: string;
  };
}

  const steps = [
    { id: 1, title: "Select System", description: "" },
    { id: 2, title: "Add Details", description: "" },
    { id: 3, title: "Integration Setting", description: "" }
  ];

export default function AIAssistAppPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Attribute mapping state
  type AttributeMapping = { source: string; target: string; defaultValue?: string; type: string };
  const [attributeMappingData, setAttributeMappingData] = useState<AttributeMapping[]>([
    {
      source: "user.name",
      target: "displayName", 
      defaultValue: "",
      type: "provisioning"
    }
  ]);
  const [attributeMappingPage, setAttributeMappingPage] = useState(1);
  const [isEditingAttribute, setIsEditingAttribute] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);
  const ATTR_MAPPING_PAGE_SIZE = 10;
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // SCIM Attributes state
  const [scimAttributes, setScimAttributes] = useState<string[]>([]);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  const [sourceAttributeValue, setSourceAttributeValue] = useState("");
  const [editSourceAttributeValue, setEditSourceAttributeValue] = useState("");
  const [filteredAttributes, setFilteredAttributes] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  
  // Application types from API
  type ApplicationTypeOption = {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    advancedSettingParts?: SupportedAppTypeAdvancedParts | null;
  };
  const [applicationTypes, setApplicationTypes] = useState<ApplicationTypeOption[]>([]);
  const [oauthTypes, setOauthTypes] = useState<string[]>([]);
  const [isLoadingAppTypes, setIsLoadingAppTypes] = useState(false);
  // Field definitions from API
  const [applicationTypeFields, setApplicationTypeFields] = useState<Record<string, string[]>>({});
  const [oauthTypeFields, setOauthTypeFields] = useState<Record<string, string[]>>({});
  const [isValidatingConnection, setIsValidatingConnection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    step1: {
      applicationName: "",
      type: "",
      oauthType: ""
    },
    step2: {
      applicationName: "",
      description: "",
      trustedSource: false,
      technicalOwner: "",
      businessOwner: ""
    },
    step3: {
      // Dynamic fields will be populated based on application type
    },
    step4: {
      complianceRequirements: [],
      securityControls: [],
      monitoringEnabled: false
    },
    step5: {
      backupFrequency: "",
      disasterRecovery: "",
      maintenanceWindow: ""
    },
    step6: {
      reviewNotes: "",
      approvalRequired: false,
      goLiveDate: ""
    }
  });

  const handleInputChange = (step: keyof FormData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: {
        ...prev[step],
        [field]: value
      }
    }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if all required fields are filled
  const isFormValid = () => {
    // Step 1: type and oauthType are required
    if (!formData.step1.type || !formData.step1.oauthType) {
      return false;
    }
    
    // Step 2: applicationName, description are required
    if (!formData.step2.applicationName || !formData.step2.description) {
      return false;
    }
    
    // Step 3: Connection Details - all fields required
    if (!formData.step3.databaseType || 
        !formData.step3.connectionURL || 
        !formData.step3.driver || 
        !formData.step3.username || 
        !formData.step3.password) {
      return false;
    }
    
    // Step 3: Application Signature - View fields are required
    if (!formData.step3.allUsersView || !formData.step3.allEntitlementsView) {
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    // Get JWT token from cookies
    const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
    
    if (!jwtToken) {
      alert("Authentication token not found. Please log in again.");
      return;
    }
    
    // Get login ID from current user
    let loginId = '';
    const currentUser = getCurrentUser();
    if (currentUser?.email) {
      loginId = currentUser.email;
    } else {
      // Fallback: try to get from UID_TENANT cookie
      const uidTenant = getCookie(COOKIE_NAMES.UID_TENANT);
      if (uidTenant) {
        try {
          const parsed = JSON.parse(uidTenant);
          loginId = parsed?.userid || parsed?.email || '';
        } catch (e) {
          console.error("Failed to parse UID_TENANT cookie:", e);
        }
      }
    }
    
    if (!loginId) {
      alert("User login ID not found. Please log in again.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Build payload from form data
      const payload = {
        applicationName: formData.step2.applicationName || "",
        trustedSource: formData.step2.trustedSource || false,
        applicationDescription: formData.step2.description || "",
        action: "pending",
        comments: "",
        requestId: "",
        sessionId: "",
        connectionDetails: {
          connectionURL: formData.step3.connectionURL || "",
          username: formData.step3.username || "",
          password: formData.step3.password || "",
          driver: formData.step3.driver || "",
          databaseType: formData.step3.databaseType || ""
        },
        applicationSignature: {
          allUsers: {
            view: formData.step3.allUsersView || "",
            filter: formData.step3.allUsersFilter || ""
          },
          allEntitlements: {
            view: formData.step3.allEntitlementsView || "",
            filter: formData.step3.allEntitlementsFilter || ""
          }
        },
        schemaMapping: {}
      };
      
      // Make API call
      const response = await fetch(
        `https://preview.keyforge.ai/aiagentcontroller/api/v1/ACMECOM/startaiagent/${loginId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      
      // Read response as text first to check for error status
      const responseText = await response.text();
      let responseData: any;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        // If response is not JSON, still check for error status in text
        const textLower = responseText.toLowerCase();
        if (textLower.includes('"status":"error"') || 
            textLower.includes('"status":"failed"') ||
            textLower.includes('"status": "error"') ||
            textLower.includes('"status": "failed"')) {
          forceLogout("API returned error status - authentication failed");
          return;
        }
        throw new Error(`Invalid response format: ${response.status} ${response.statusText}`);
      }
      
      // Check for status = "error" in response (even if response.ok is true)
      if (responseData && typeof responseData === 'object') {
        const status = responseData.status || responseData.Status || responseData.STATUS;
        if (status !== undefined && status !== null) {
          const statusStr = String(status).toLowerCase().trim();
          if (statusStr === 'error' || statusStr === 'failed') {
            forceLogout("API returned error status - authentication failed");
            return;
          }
        }
      }
      
      if (!response.ok) {
        throw new Error(responseData?.message || `Application submission failed with status ${response.status}`);
      }
      
      // Success
      alert("AI Assist App added successfully!");
      console.log("Application submission response:", responseData);
      router.push("/settings/app-inventory");
      
    } catch (error) {
      console.error("Application submission error:", error);
      alert(error instanceof Error ? error.message : "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateConnection = async () => {
    // Validate connection details
    const { databaseType, connectionURL, driver, username, password } = formData.step3;
    
    if (!databaseType || !connectionURL || !driver || !username || !password) {
      alert("Please fill in all required connection details.");
      return;
    }
    
    // Get JWT token from cookies
    const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
    
    if (!jwtToken) {
      alert("Authentication token not found. Please log in again.");
      return;
    }
    
    setIsValidatingConnection(true);
    
    try {
      // Prepare payload
      const payload = {
        connectionURL,
        username,
        password,
        driver,
        databaseType
      };
      
      // Make API call
      const response = await fetch(
        'https://preview.keyforge.ai/aiagentcontroller/api/v1/ACMECOM/dbagent/testconnection',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      
      // Read response as text first to check for error status
      const responseText = await response.text();
      let responseData: any;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        // If response is not JSON, still check for error status in text
        const textLower = responseText.toLowerCase();
        if (textLower.includes('"status":"error"') || 
            textLower.includes('"status":"failed"') ||
            textLower.includes('"status": "error"') ||
            textLower.includes('"status": "failed"')) {
          forceLogout("API returned error status - authentication failed");
          return;
        }
        throw new Error(`Invalid response format: ${response.status} ${response.statusText}`);
      }
      
      // Check for status = "error" in response (even if response.ok is true)
      if (responseData && typeof responseData === 'object') {
        const status = responseData.status || responseData.Status || responseData.STATUS;
        if (status !== undefined && status !== null) {
          const statusStr = String(status).toLowerCase().trim();
          if (statusStr === 'error' || statusStr === 'failed') {
            forceLogout("API returned error status - authentication failed");
            return;
          }
        }
      }
      
      if (!response.ok) {
        throw new Error(responseData?.message || `Connection test failed with status ${response.status}`);
      }
      
      // Success
      alert("Connection validated successfully!");
      console.log("Connection validation response:", responseData);
      
    } catch (error) {
      console.error("Connection validation error:", error);
      alert(error instanceof Error ? error.message : "Failed to validate connection. Please check your connection details and try again.");
    } finally {
      setIsValidatingConnection(false);
    }
  };

  // Attribute mapping helper functions
  const getCurrentPageData = (): AttributeMapping[] => {
    const start = (attributeMappingPage - 1) * ATTR_MAPPING_PAGE_SIZE;
    const end = start + ATTR_MAPPING_PAGE_SIZE;
    return attributeMappingData.slice(start, end);
  };

  const getAttributeMappingTotalPages = (): number => {
    return Math.max(1, Math.ceil(attributeMappingData.length / ATTR_MAPPING_PAGE_SIZE));
  };

  // Fetch application types from API
  const fetchApplicationTypes = async () => {
    setIsLoadingAppTypes(true);
    try {
      console.log("Fetching application types from API...");
      const data = await getAllSupportedApplicationTypesViaProxy();
      console.log("API Response:", data);
      
      // Extract application types from API response
      // API returns: { applicationType: [{ "LDAP": [...] }, { "Generic LDAP": [...] }, ...] }
      if (data?.applicationType && Array.isArray(data.applicationType)) {
        const fieldMap: Record<string, string[]> = {};
        const extractedTypes: ApplicationTypeOption[] = [];
        for (const raw of data.applicationType as unknown[]) {
          const parsed = parseSupportedObjectsApplicationTypeItem(raw);
          if (!parsed) continue;
          fieldMap[parsed.typeName] = parsed.fields;
          extractedTypes.push({
            id: parsed.typeName,
            title: parsed.typeName,
            subtitle: `${parsed.typeName} application type`,
            icon: "📦",
            advancedSettingParts: parsed.advancedSettingParts,
          });
        }
        console.log("Extracted application types:", extractedTypes);
        setApplicationTypes(extractedTypes);
        setApplicationTypeFields(fieldMap);
      } else {
        console.warn("No applicationType found in API response or invalid format:", data);
      }
      
      // Extract OAuth types from API response
      // API returns: { oauthType: [{ "OKTA": [...] }, { "IDCS": [...] }, ...] }
      if (data?.oauthType && Array.isArray(data.oauthType)) {
        const oauthFieldMap: Record<string, string[]> = {};
        const extractedOauthTypes = data.oauthType.map((item: any) => {
          // Each item is an object with one key (the oauth type name)
          const key = Object.keys(item)[0];
          const fields = item[key];
          if (Array.isArray(fields)) oauthFieldMap[key] = normalizeSupportedObjectsFieldArray(fields);
          return key;
        });
        console.log("Extracted OAuth types:", extractedOauthTypes);
        setOauthTypes(extractedOauthTypes);
        setOauthTypeFields(oauthFieldMap);
      } else {
        console.warn("No oauthType found in API response or invalid format:", data);
      }
    } catch (error) {
      console.error("Error fetching application types:", error);
      setApplicationTypes([]);
      setOauthTypes([]);
      setApplicationTypeFields({});
      setOauthTypeFields({});
    } finally {
      setIsLoadingAppTypes(false);
    }
  };

  // Fetch application types on component mount
  useEffect(() => {
    fetchApplicationTypes();
  }, []);

  // Fetch SCIM attributes from API
  const fetchScimAttributes = async () => {
    setIsLoadingAttributes(true);
    try {
      const response = await fetch("https://preview.keyforge.ai/schemamapper/getscim/ACMECOM", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SCIM attributes: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === "success" && Array.isArray(data.scimAttributes)) {
        setScimAttributes(data.scimAttributes);
        setFilteredAttributes(data.scimAttributes);
      } else {
        console.error("Invalid API response format");
        setScimAttributes([]);
        setFilteredAttributes([]);
      }
    } catch (error) {
      console.error("Error fetching SCIM attributes:", error);
      setScimAttributes([]);
      setFilteredAttributes([]);
    } finally {
      setIsLoadingAttributes(false);
    }
  };

  // Handle dropdown click - fetch attributes if not already fetched
  const handleDropdownToggle = () => {
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
    setIsDropdownOpen(!isDropdownOpen);
    setFilteredAttributes(scimAttributes);
  };

  const handleEditDropdownToggle = () => {
    if (scimAttributes.length === 0 && !isLoadingAttributes) {
      fetchScimAttributes();
    }
    setIsEditDropdownOpen(!isEditDropdownOpen);
    setFilteredAttributes(scimAttributes);
  };

  // Filter attributes based on search input
  const filterAttributes = (searchTerm: string, isEdit: boolean = false) => {
    if (searchTerm === "") {
      setFilteredAttributes(scimAttributes);
    } else {
      const search = searchTerm.toLowerCase();
      const filtered = scimAttributes.filter((attr) =>
        attr.toLowerCase().includes(search)
      );
      setFilteredAttributes(filtered);
    }
    
    if (isEdit) {
      setEditSourceAttributeValue(searchTerm);
    } else {
      setSourceAttributeValue(searchTerm);
    }
  };

  // Select an attribute from dropdown
  const selectAttribute = (attribute: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditSourceAttributeValue(attribute);
      setIsEditDropdownOpen(false);
    } else {
      setSourceAttributeValue(attribute);
      setIsDropdownOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        editDropdownRef.current &&
        !editDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEditDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize edit source attribute value when editing starts
  useEffect(() => {
    if (isEditingAttribute && editingAttribute) {
      setEditSourceAttributeValue(editingAttribute.source || "");
    }
  }, [isEditingAttribute, editingAttribute]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <div className="flex-1 relative">
                 <input
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onFocus={() => setIsSearchFocused(true)}
                   onBlur={() => setIsSearchFocused(false)}
                   className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                   placeholder=" "
                 />
                 <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                   searchQuery || isSearchFocused
                     ? 'top-0.5 text-xs text-blue-600' 
                     : 'top-3.5 text-sm text-gray-500'
                 }`}>
                   Search *
                 </label>
               </div>
               <div className="flex-1 relative">
                 <select
                   value={formData.step1.oauthType}
                   onChange={(e) => handleInputChange("step1", "oauthType", e.target.value)}
                   className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                   required
                   disabled={isLoadingAppTypes}
                 >
                   <option value=""></option>
                   {oauthTypes.map((oauthType) => (
                     <option key={oauthType} value={oauthType}>
                       {oauthType}
                     </option>
                   ))}
                 </select>
                 <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                   formData.step1.oauthType 
                     ? 'top-0.5 text-xs text-blue-600' 
                     : 'top-3.5 text-sm text-gray-500'
                 }`}>
                   OAuth Type *
                 </label>
               </div>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-4">
                 Application Type *
               </label>
               {isLoadingAppTypes ? (
                 <div className="flex items-center justify-center p-8">
                   <div className="text-gray-500">Loading application types...</div>
                 </div>
               ) : (
               <div className="grid grid-cols-3 gap-4">
                 {applicationTypes.length === 0 ? (
                   <div className="col-span-3 text-center text-gray-500 p-4">
                     No application types available. Please check the API connection.
                   </div>
                 ) : (
                   applicationTypes
                     .filter((type) => 
                       searchQuery === "" || 
                       type.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       type.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       type.id.toLowerCase().includes(searchQuery.toLowerCase())
                     )
                     .map((type) => (
                   <div
                     key={type.id}
                     onClick={() => handleInputChange("step1", "type", type.id)}
                     className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                       formData.step1.type === type.id
                         ? "border-blue-500 bg-blue-50"
                         : "border-gray-200 bg-white hover:border-gray-300"
                     }`}
                   >
                     <div className="flex items-center mb-2">
                       <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-lg mr-3">
                         {type.icon}
                       </div>
                     <div className="flex-1">
                       <h3 className="font-medium text-gray-900 text-sm">{type.title}</h3>
                       <p className="text-xs text-gray-500">{type.subtitle}</p>
                       {type.advancedSettingParts && (
                         <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-3 gap-1.5">
                           {(
                             [
                               { key: "hook" as const, label: "Hook" },
                               { key: "threshold" as const, label: "Threshold" },
                               { key: "autoRetry" as const, label: "Auto retry" },
                             ] as const
                           ).map(({ key, label }) => (
                             <div
                               key={key}
                               className="rounded-md border border-gray-200 bg-gray-50 px-1 py-1 text-center"
                             >
                               <div className="text-[9px] font-semibold uppercase text-gray-500 leading-tight">{label}</div>
                               <div className="text-[10px] text-gray-700 mt-0.5 line-clamp-2">
                                 {describeAdvancedSettingSlotValue(type.advancedSettingParts[key])}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                       {formData.step1.type === type.id && (
                         <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                           <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         </div>
                       )}
                     </div>
                   </div>
                     ))
                 )}
               </div>
               )}
             </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Selected summary from Step 1 */}
            <div className="p-4 border border-blue-100 rounded-md bg-blue-50 text-sm text-blue-800">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="font-medium">Selected System:</span>{' '}
                  <span>{formData.step1.type || "Not selected"}</span>
                </div>
                <div>
                  <span className="font-medium">OAuth Type:</span>{' '}
                  <span>{formData.step1.oauthType || "Not selected"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-[3] relative">
                <input
                  type="text"
                  value={formData.step2.applicationName}
                  onChange={(e) => handleInputChange("step2", "applicationName", e.target.value)}
                  className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step2.applicationName
                    ? 'top-0.5 text-xs text-blue-600' 
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Application Name *
                </label>
              </div>
              <div className="flex-none flex items-center pt-1">
                <input
                  type="checkbox"
                  id="trustedSource"
                  checked={formData.step2.trustedSource}
                  onChange={(e) => handleInputChange("step2", "trustedSource", e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="trustedSource" className="ml-2 text-sm text-gray-700 cursor-pointer">
                  Trusted Source
                </label>
              </div>
            </div>
            <div className="relative">
              <textarea
                value={formData.step2.description}
                onChange={(e) => handleInputChange("step2", "description", e.target.value)}
                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline resize-none"
                rows={3}
                placeholder=" "
              />
              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                formData.step2.description
                  ? 'top-0.5 text-xs text-blue-600' 
                  : 'top-3.5 text-sm text-gray-500'
              }`}>
                Description *
              </label>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.step2.technicalOwner}
                  onChange={(e) => handleInputChange("step2", "technicalOwner", e.target.value)}
                  className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step2.technicalOwner
                    ? 'top-0.5 text-xs text-blue-600' 
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Technical Owner *
                </label>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.step2.businessOwner}
                  onChange={(e) => handleInputChange("step2", "businessOwner", e.target.value)}
                  className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                  placeholder=" "
                />
                <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                  formData.step2.businessOwner
                    ? 'top-0.5 text-xs text-blue-600' 
                    : 'top-3.5 text-sm text-gray-500'
                }`}>
                  Business Owner *
                </label>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            {/* Connection Details Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                Connection Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.databaseType || ""}
                    onChange={(e) => handleInputChange("step3", "databaseType", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.databaseType
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Database Type *
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.connectionURL || ""}
                    onChange={(e) => handleInputChange("step3", "connectionURL", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.connectionURL
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Connection URL *
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.driver || ""}
                    onChange={(e) => handleInputChange("step3", "driver", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.driver
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Driver *
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.step3.username || ""}
                    onChange={(e) => handleInputChange("step3", "username", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.username
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Username *
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.step3.password || ""}
                    onChange={(e) => handleInputChange("step3", "password", e.target.value)}
                    className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                    placeholder=" "
                  />
                  <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                    formData.step3.password
                      ? 'top-0.5 text-xs text-blue-600' 
                      : 'top-3.5 text-sm text-gray-500'
                  }`}>
                    Password *
                  </label>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleValidateConnection}
                  disabled={
                    isValidatingConnection ||
                    !formData.step3.databaseType ||
                    !formData.step3.connectionURL ||
                    !formData.step3.driver ||
                    !formData.step3.username ||
                    !formData.step3.password
                  }
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    isValidatingConnection ||
                    !formData.step3.databaseType ||
                    !formData.step3.connectionURL ||
                    !formData.step3.driver ||
                    !formData.step3.username ||
                    !formData.step3.password
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isValidatingConnection ? 'Validating...' : 'Validate'}
                </button>
              </div>
            </div>

            {/* Application Signature Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                Application Signature
              </h3>
              
              {/* All Users Subsection */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-base font-medium text-gray-800 mb-4">All Users</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.allUsersView || ""}
                      onChange={(e) => handleInputChange("step3", "allUsersView", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.allUsersView
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      View *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.allUsersFilter || ""}
                      onChange={(e) => handleInputChange("step3", "allUsersFilter", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.allUsersFilter
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Filter
                    </label>
                  </div>
                </div>
              </div>

              {/* All Entitlements Subsection */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-base font-medium text-gray-800 mb-4">All Entitlements</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.allEntitlementsView || ""}
                      onChange={(e) => handleInputChange("step3", "allEntitlementsView", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.allEntitlementsView
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      View *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.step3.allEntitlementsFilter || ""}
                      onChange={(e) => handleInputChange("step3", "allEntitlementsFilter", e.target.value)}
                      className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 no-underline"
                      placeholder=" "
                    />
                    <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                      formData.step3.allEntitlementsFilter
                        ? 'top-0.5 text-xs text-blue-600' 
                        : 'top-3.5 text-sm text-gray-500'
                    }`}>
                      Filter
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-4">
         {/* Progress Steps */}
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
           <div className="flex items-center justify-between">
             {steps.map((step, index) => (
               <div key={step.id} className="flex items-center">
                 <div
                   className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                     currentStep >= step.id
                       ? "bg-blue-600 text-white"
                       : "bg-gray-200 text-gray-600"
                   }`}
                 >
                   {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                 </div>
                 <div className="ml-3">
                   <p className="text-sm font-medium text-gray-900">{step.title}</p>
                 </div>
                 {index < steps.length - 1 && (
                   <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
                 )}
               </div>
             ))}
           </div>
         </div>

        {/* Navigation Buttons - moved to top */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                currentStep === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            <div className="flex gap-3">
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isFormValid()}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                    isSubmitting || !isFormValid()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
