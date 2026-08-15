"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function GatewayGeneralSettings() {
  const [expandedCards, setExpandedCards] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [cmdbFormData, setCmdbFormData] = useState({
    cmdbSystem: "",
    apiEndpoint: "",
    usernameClientId: "",
    passwordClientSecret: "",
    authenticationType: "",
    authUrl: "",
    tableClassName: "",
    queryParametersFilter: "",
    retrievalFields: "",
  });
  const [igaFormData, setIgaFormData] = useState({
    igaSystem: "",
    application_server_type: "",
    naming_provider_url: "",
    auth_login_config_path: "",
    username: "",
    password: "",
    dbSchema: "",
  });
  const [itsmFormData, setItsmFormData] = useState({
    itsmSystem: "",
  });
  const [emailFormData, setEmailFormData] = useState({
    fromEmail: "",
    smtpHost: "",
    smtpPort: "",
    smtpUsername: "",
    smtpPassword: "",
    enabled: false,
    testingMode: false,
    testingEmail: "",
  });
  const [focusedFields, setFocusedFields] = useState<Record<string, boolean>>({});

  const cards = [
    { title: "Setup CMDB", key: "cmdb" },
    { title: "Setup IGA", key: "iga" },
    { title: "Setup ITSM Integration", key: "itsm" },
    { title: "Setup Microsoft Teams Integration", key: "teams" },
    { title: "Email Server Setup", key: "email" },
    { title: "Setup HashiCorp Vault", key: "vault" },
    { title: "Setup logs", key: "logs" },
  ];

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const handleCmdbFieldChange = (field: string, value: string) => {
    setCmdbFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleIgaFieldChange = (field: string, value: string) => {
    setIgaFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleItsmFieldChange = (field: string, value: string) => {
    setItsmFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmailFieldChange = (field: string, value: string | boolean) => {
    setEmailFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFieldFocus = (field: string) => {
    setFocusedFields((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldBlur = (field: string) => {
    setFocusedFields((prev) => ({ ...prev, [field]: false }));
  };

  // Load saved CMDB data from localStorage on component mount
  useEffect(() => {
    const savedCmdbData = localStorage.getItem("gateway_cmdb_settings");
    if (savedCmdbData) {
      try {
        const parsed = JSON.parse(savedCmdbData);
        setCmdbFormData(parsed);
      } catch (error) {
        console.error("Error loading saved CMDB settings:", error);
      }
    }
  }, []);

  // Load saved IGA data from localStorage on component mount
  useEffect(() => {
    const savedIgaData = localStorage.getItem("gateway_iga_settings");
    if (savedIgaData) {
      try {
        const parsed = JSON.parse(savedIgaData);
        setIgaFormData(parsed);
      } catch (error) {
        console.error("Error loading saved IGA settings:", error);
      }
    }
  }, []);

  // Load saved ITSM data from localStorage on component mount
  useEffect(() => {
    const savedItsmData = localStorage.getItem("gateway_itsm_settings");
    if (savedItsmData) {
      try {
        const parsed = JSON.parse(savedItsmData);
        setItsmFormData(parsed);
      } catch (error) {
        console.error("Error loading saved ITSM settings:", error);
      }
    }
  }, []);

  // Load saved Email data from localStorage on component mount
  useEffect(() => {
    const savedEmailData = localStorage.getItem("gateway_email_settings");
    if (savedEmailData) {
      try {
        const parsed = JSON.parse(savedEmailData);
        setEmailFormData(parsed);
      } catch (error) {
        console.error("Error loading saved Email settings:", error);
      }
    }
  }, []);

  const handleSaveCmdb = () => {
    // Save CMDB form data to localStorage
    localStorage.setItem("gateway_cmdb_settings", JSON.stringify(cmdbFormData));
    alert("CMDB settings saved successfully!");
  };

  const handleSave = () => {
    // Save IGA form data to localStorage
    localStorage.setItem("gateway_iga_settings", JSON.stringify(igaFormData));
  };

  const handleSaveItsm = () => {
    // Save ITSM form data to localStorage
    localStorage.setItem("gateway_itsm_settings", JSON.stringify(itsmFormData));
    alert("ITSM Integration settings saved successfully!");
  };

  const handleSaveEmail = () => {
    // Save Email form data to localStorage
    localStorage.setItem("gateway_email_settings", JSON.stringify(emailFormData));
    alert("Email Server settings saved successfully!");
  };

  return (
    <div className="h-full p-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">General</h1>
        <div className="space-y-4">
          {cards.map((card, idx) => (
            <div key={card.key} className="border border-gray-200 rounded-xl shadow-sm overflow-hidden bg-white">
              <button
                className="w-full flex items-center justify-between px-4 py-4 bg-white font-semibold text-sm hover:bg-gray-50 transition-colors group"
                onClick={() => toggleCard(idx)}
                aria-expanded={expandedCards[idx] ? "true" : "false"}
              >
                <span className="flex-1 text-left mr-3 text-gray-900">
                  {card.title}
                </span>
                <div className="flex-shrink-0">
                  {expandedCards[idx] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  )}
                </div>
              </button>
              {expandedCards[idx] && (
                <div className="p-4 text-sm space-y-4 bg-gray-50 border-t border-gray-100">
                  {card.key === "cmdb" ? (
                    <>
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Setup CMDB</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                              <select
                                value={cmdbFormData.cmdbSystem}
                                onChange={(e) => handleCmdbFieldChange("cmdbSystem", e.target.value)}
                                onFocus={() => handleFieldFocus("cmdbSystem")}
                                onBlur={() => handleFieldBlur("cmdbSystem")}
                                className="w-full px-4 pt-5 pb-1.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                              >
                                <option value=""></option>
                                <option value="ServiceNow">ServiceNow</option>
                                <option value="BMC Remedy">BMC Remedy</option>
                                <option value="MicroFocus UCDMB">MicroFocus UCDMB</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.cmdbSystem || focusedFields.cmdbSystem
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Select your CMDB System *
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={cmdbFormData.apiEndpoint}
                                onChange={(e) => handleCmdbFieldChange("apiEndpoint", e.target.value)}
                                onFocus={() => handleFieldFocus("apiEndpoint")}
                                onBlur={() => handleFieldBlur("apiEndpoint")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.apiEndpoint || focusedFields.apiEndpoint
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                API Endpoint
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={cmdbFormData.usernameClientId}
                                onChange={(e) => handleCmdbFieldChange("usernameClientId", e.target.value)}
                                onFocus={() => handleFieldFocus("usernameClientId")}
                                onBlur={() => handleFieldBlur("usernameClientId")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.usernameClientId || focusedFields.usernameClientId
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Username/Client ID
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="password"
                                value={cmdbFormData.passwordClientSecret}
                                onChange={(e) => handleCmdbFieldChange("passwordClientSecret", e.target.value)}
                                onFocus={() => handleFieldFocus("passwordClientSecret")}
                                onBlur={() => handleFieldBlur("passwordClientSecret")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.passwordClientSecret || focusedFields.passwordClientSecret
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Pwd/Client Secret
                              </label>
                            </div>
                            <div className="relative">
                              <select
                                value={cmdbFormData.authenticationType}
                                onChange={(e) => handleCmdbFieldChange("authenticationType", e.target.value)}
                                onFocus={() => handleFieldFocus("authenticationType")}
                                onBlur={() => handleFieldBlur("authenticationType")}
                                className="w-full px-4 pt-5 pb-1.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                              >
                                <option value=""></option>
                                <option value="Basic Auth">Basic Auth</option>
                                <option value="OAuth 2.0">OAuth 2.0</option>
                                <option value="Bearer Token">Bearer Token</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.authenticationType || focusedFields.authenticationType
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Authentication Type
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={cmdbFormData.authUrl}
                                onChange={(e) => handleCmdbFieldChange("authUrl", e.target.value)}
                                onFocus={() => handleFieldFocus("authUrl")}
                                onBlur={() => handleFieldBlur("authUrl")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.authUrl || focusedFields.authUrl
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Auth URL
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-6">
                          <h4 className="text-sm font-medium text-gray-700 mb-4">Advanced</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={cmdbFormData.tableClassName}
                                onChange={(e) => handleCmdbFieldChange("tableClassName", e.target.value)}
                                onFocus={() => handleFieldFocus("tableClassName")}
                                onBlur={() => handleFieldBlur("tableClassName")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.tableClassName || focusedFields.tableClassName
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Table/Class Name
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={cmdbFormData.queryParametersFilter}
                                onChange={(e) => handleCmdbFieldChange("queryParametersFilter", e.target.value)}
                                onFocus={() => handleFieldFocus("queryParametersFilter")}
                                onBlur={() => handleFieldBlur("queryParametersFilter")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.queryParametersFilter || focusedFields.queryParametersFilter
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Query Parameters/Filter
                              </label>
                            </div>
                            <div className="relative md:col-span-2">
                              <input
                                type="text"
                                value={cmdbFormData.retrievalFields}
                                onChange={(e) => handleCmdbFieldChange("retrievalFields", e.target.value)}
                                onFocus={() => handleFieldFocus("retrievalFields")}
                                onBlur={() => handleFieldBlur("retrievalFields")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                cmdbFormData.retrievalFields || focusedFields.retrievalFields
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Retrieval Fields
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSaveCmdb}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : card.key === "iga" ? (
                    <>
                      <div className="space-y-6">
                        <div>
                          <div className="relative">
                            <select
                              value={igaFormData.igaSystem}
                              onChange={(e) => handleIgaFieldChange("igaSystem", e.target.value)}
                              onFocus={() => handleFieldFocus("igaSystem")}
                              onBlur={() => handleFieldBlur("igaSystem")}
                              className="w-full px-4 pt-5 pb-1.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                            >
                              <option value=""></option>
                              <option value="Oracle Identity Manager">Oracle Identity Manager</option>
                              <option value="Oracle Access Governance">Oracle Access Governance</option>
                              <option value="Sailpoint IIQ">Sailpoint IIQ</option>
                              <option value="Sailpoint Identity Security Cloud">Sailpoint Identity Security Cloud</option>
                              <option value="Saviynt">Saviynt</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                              igaFormData.igaSystem || focusedFields.igaSystem
                                ? 'top-0.5 text-xs text-blue-600' 
                                : 'top-3.5 text-sm text-gray-500'
                            }`}>
                              Select your IGA System *
                            </label>
                          </div>
                        </div>
                        <div>
                          <div className="grid grid-cols-3 gap-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={igaFormData.application_server_type}
                            onChange={(e) => handleIgaFieldChange("application_server_type", e.target.value)}
                            onFocus={() => handleFieldFocus("application_server_type")}
                            onBlur={() => handleFieldBlur("application_server_type")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.application_server_type || focusedFields.application_server_type
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Application Server Type
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={igaFormData.naming_provider_url}
                            onChange={(e) => handleIgaFieldChange("naming_provider_url", e.target.value)}
                            onFocus={() => handleFieldFocus("naming_provider_url")}
                            onBlur={() => handleFieldBlur("naming_provider_url")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.naming_provider_url || focusedFields.naming_provider_url
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Naming Provider URL
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={igaFormData.auth_login_config_path}
                            onChange={(e) => handleIgaFieldChange("auth_login_config_path", e.target.value)}
                            onFocus={() => handleFieldFocus("auth_login_config_path")}
                            onBlur={() => handleFieldBlur("auth_login_config_path")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.auth_login_config_path || focusedFields.auth_login_config_path
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Auth Login Config Path
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={igaFormData.username}
                            onChange={(e) => handleIgaFieldChange("username", e.target.value)}
                            onFocus={() => handleFieldFocus("username")}
                            onBlur={() => handleFieldBlur("username")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.username || focusedFields.username
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Username
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="password"
                            value={igaFormData.password}
                            onChange={(e) => handleIgaFieldChange("password", e.target.value)}
                            onFocus={() => handleFieldFocus("password")}
                            onBlur={() => handleFieldBlur("password")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.password || focusedFields.password
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Password
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={igaFormData.dbSchema}
                            onChange={(e) => handleIgaFieldChange("dbSchema", e.target.value)}
                            onFocus={() => handleFieldFocus("dbSchema")}
                            onBlur={() => handleFieldBlur("dbSchema")}
                            className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            placeholder=" "
                          />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            igaFormData.dbSchema || focusedFields.dbSchema
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            DB Schema
                          </label>
                        </div>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : card.key === "itsm" ? (
                    <>
                      <div className="space-y-6">
                        <div className="relative">
                          <select
                            value={itsmFormData.itsmSystem}
                            onChange={(e) => handleItsmFieldChange("itsmSystem", e.target.value)}
                            onFocus={() => handleFieldFocus("itsmSystem")}
                            onBlur={() => handleFieldBlur("itsmSystem")}
                            className="w-full px-4 pt-5 pb-1.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                          >
                            <option value=""></option>
                            <option value="ServiceNow">ServiceNow</option>
                            <option value="BMC Remedy">BMC Remedy</option>
                            <option value="Jira Service Management">Jira Service Management</option>
                            <option value="ManageEngine ServiceDesk">ManageEngine ServiceDesk</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                            itsmFormData.itsmSystem || focusedFields.itsmSystem
                              ? 'top-0.5 text-xs text-blue-600' 
                              : 'top-3.5 text-sm text-gray-500'
                          }`}>
                            Select your ITSM System *
                          </label>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSaveItsm}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : card.key === "teams" ? (
                    <>
                      <div className="space-y-6">
                        <div className="text-gray-600">
                          {/* Microsoft Teams Integration content will be added here */}
                        </div>
                      </div>
                    </>
                  ) : card.key === "email" ? (
                    <>
                      <div className="space-y-6">
                        {/* From Email address Section */}
                        <div className="flex items-start gap-4">
                          <div className="flex-1 relative">
                            <input
                              type="email"
                              value={emailFormData.fromEmail}
                              onChange={(e) => handleEmailFieldChange("fromEmail", e.target.value)}
                              onFocus={() => handleFieldFocus("fromEmail")}
                              onBlur={() => handleFieldBlur("fromEmail")}
                              className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                              placeholder=" "
                            />
                            <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                              emailFormData.fromEmail || focusedFields.fromEmail
                                ? 'top-0.5 text-xs text-blue-600' 
                                : 'top-3.5 text-sm text-gray-500'
                            }`}>
                              From Email address
                            </label>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <label className="text-sm font-medium text-gray-700">Enabled</label>
                            <button
                              type="button"
                              onClick={() => handleEmailFieldChange("enabled", !emailFormData.enabled)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                emailFormData.enabled ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  emailFormData.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* SMTP Server Section */}
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-gray-900">SMTP Server</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                              <input
                                type="text"
                                value={emailFormData.smtpHost}
                                onChange={(e) => handleEmailFieldChange("smtpHost", e.target.value)}
                                onFocus={() => handleFieldFocus("smtpHost")}
                                onBlur={() => handleFieldBlur("smtpHost")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                emailFormData.smtpHost || focusedFields.smtpHost
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Host
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={emailFormData.smtpPort}
                                onChange={(e) => handleEmailFieldChange("smtpPort", e.target.value)}
                                onFocus={() => handleFieldFocus("smtpPort")}
                                onBlur={() => handleFieldBlur("smtpPort")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                emailFormData.smtpPort || focusedFields.smtpPort
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Port
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={emailFormData.smtpUsername}
                                onChange={(e) => handleEmailFieldChange("smtpUsername", e.target.value)}
                                onFocus={() => handleFieldFocus("smtpUsername")}
                                onBlur={() => handleFieldBlur("smtpUsername")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                emailFormData.smtpUsername || focusedFields.smtpUsername
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Username
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                type="password"
                                value={emailFormData.smtpPassword}
                                onChange={(e) => handleEmailFieldChange("smtpPassword", e.target.value)}
                                onFocus={() => handleFieldFocus("smtpPassword")}
                                onBlur={() => handleFieldBlur("smtpPassword")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                emailFormData.smtpPassword || focusedFields.smtpPassword
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Password
                              </label>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-4">
                            <label className="text-sm font-medium text-gray-700">Testing Mode</label>
                            <button
                              type="button"
                              onClick={() => handleEmailFieldChange("testingMode", !emailFormData.testingMode)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                emailFormData.testingMode ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  emailFormData.testingMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                          
                          {emailFormData.testingMode && (
                            <div className="relative">
                              <input
                                type="email"
                                value={emailFormData.testingEmail}
                                onChange={(e) => handleEmailFieldChange("testingEmail", e.target.value)}
                                onFocus={() => handleFieldFocus("testingEmail")}
                                onBlur={() => handleFieldBlur("testingEmail")}
                                className="w-full px-4 pt-5 pb-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                placeholder=" "
                              />
                              <label className={`absolute left-4 transition-all duration-200 pointer-events-none ${
                                emailFormData.testingEmail || focusedFields.testingEmail
                                  ? 'top-0.5 text-xs text-blue-600' 
                                  : 'top-3.5 text-sm text-gray-500'
                              }`}>
                                Testing Email Address
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handleSaveEmail}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-600">
                      {/* Content for {card.title} */}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


