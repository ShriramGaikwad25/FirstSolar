"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ChevronDown, 
  ChevronRight,
  Search,
  User,
  ShieldCheck,
  RefreshCw,
  Tag,
  Check,
  ArrowRight,
  Plus,
  X
} from 'lucide-react';

export default function SAMSettingsPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['discovery']));
  const [discoveryItems, setDiscoveryItems] = useState({
    applications: false,
    containers: false,
    servers: false,
    ociCloudServices: false
  });
  const [ownershipItems, setOwnershipItems] = useState({
    backupOwner: [] as string[],
    custodian: [] as string[],
    endUserSME: [] as string[]
  });
  const [securityItems, setSecurityItems] = useState({
    pamIntegration: false,
    jitAccess: false
  });
  const [attributeItems, setAttributeItems] = useState({
    accountType: false,
    ownerCustodianUserId: false,
    backupOwnerId: false,
    businessService: false,
    environment: false,
    rotationPolicy: false,
    pamPolicyRef: false,
    smeUsers: false
  });
  const [customAttribute, setCustomAttribute] = useState('');
  const [customAttributes, setCustomAttributes] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState({
    backupOwner: false,
    custodian: false,
    endUserSME: false
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleDiscoveryItemChange = (item: keyof typeof discoveryItems) => {
    setDiscoveryItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleOwnershipItemChange = (item: keyof typeof ownershipItems, value: string) => {
    setOwnershipItems(prev => {
      const currentValues = prev[item];
      if (currentValues.includes(value)) {
        // Remove if already selected
        return {
          ...prev,
          [item]: currentValues.filter(v => v !== value)
        };
      } else {
        // Add if not selected
        return {
          ...prev,
          [item]: [...currentValues, value]
        };
      }
    });
  };

  const handleSecurityItemChange = (item: keyof typeof securityItems) => {
    setSecurityItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const handleAttributeItemChange = (item: keyof typeof attributeItems) => {
    setAttributeItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const addCustomAttribute = () => {
    if (customAttribute.trim() && !customAttributes.includes(customAttribute.trim())) {
      setCustomAttributes(prev => [...prev, customAttribute.trim()]);
      setCustomAttribute('');
    }
  };

  const removeCustomAttribute = (index: number) => {
    setCustomAttributes(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDropdown = (dropdown: keyof typeof dropdownOpen) => {
    setDropdownOpen(prev => ({
      ...prev,
      [dropdown]: !prev[dropdown]
    }));
  };

  const userTypes = [
    'Regular User',
    'User Manager', 
    'Application Technical Owner',
    'Application Business Owner',
    'IAM Admin'
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setDropdownOpen({
          backupOwner: false,
          custodian: false,
          endUserSME: false
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sections = [
    { 
      id: 'discovery', 
      title: 'Discovery', 
      icon: Search, 
      description: 'Discover and configure SAM providers and endpoints',
      color: 'blue'
    },
    { 
      id: 'ownership', 
      title: 'Ownership', 
      icon: User, 
      description: 'Manage application ownership and access controls',
      color: 'green'
    },
    { 
      id: 'security', 
      title: 'Security', 
      icon: ShieldCheck, 
      description: 'Configure security settings and certificates',
      color: 'red'
    },
    { 
      id: 'lifecycle', 
      title: 'Lifecycle', 
      icon: RefreshCw, 
      description: 'Manage configuration lifecycle and updates',
      color: 'purple'
    },
    { 
      id: 'attributes', 
      title: 'Attributes', 
      icon: Tag, 
      description: 'Define and map user attributes',
      color: 'orange'
    }
  ];

  return (
    <div className="h-full p-6">
      <div className="max-w-7xl mx-auto">
        {/* SAM Heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">SAM</h1>
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.has(section.id);
            
            return (
              <div key={section.id} className="bg-white rounded-lg shadow border border-gray-200">
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full px-6 py-4 text-left transition-colors ${
                    isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${section.color}-100`}>
                        <Icon className={`h-5 w-5 text-${section.color}-600`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-gray-200">
                    <div className="pt-4">
                      {section.id === 'discovery' && (
                        <div className="space-y-4 ml-4">
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="applications"
                                checked={discoveryItems.applications}
                                onChange={() => handleDiscoveryItemChange('applications')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="applications" className="ml-3 text-sm font-medium text-gray-700">
                                Applications
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="containers"
                                checked={discoveryItems.containers}
                                onChange={() => handleDiscoveryItemChange('containers')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="containers" className="ml-3 text-sm font-medium text-gray-700">
                                Containers
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="servers"
                                checked={discoveryItems.servers}
                                onChange={() => handleDiscoveryItemChange('servers')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="servers" className="ml-3 text-sm font-medium text-gray-700">
                                Servers
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="ociCloudServices"
                                checked={discoveryItems.ociCloudServices}
                                onChange={() => handleDiscoveryItemChange('ociCloudServices')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="ociCloudServices" className="ml-3 text-sm font-medium text-gray-700">
                                OCI Cloud Services
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      {section.id === 'ownership' && (
                        <div className="ml-4">
                          <div className="flex items-center justify-between gap-4">
                            {/* Backup Owner Box */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex-1 relative dropdown-container">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Backup Owner</h4>
                              <button
                                onClick={() => toggleDropdown('backupOwner')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between bg-white"
                              >
                                <span className="text-sm text-gray-700">
                                  {ownershipItems.backupOwner.length === 0 
                                    ? 'Select options...' 
                                    : `${ownershipItems.backupOwner.length} selected`
                                  }
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen.backupOwner ? 'rotate-180' : ''}`} />
                              </button>
                              
                              {dropdownOpen.backupOwner && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                                  <div className="p-2 space-y-1">
                                    {userTypes.map((userType) => (
                                      <label key={userType} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ownershipItems.backupOwner.includes(userType)}
                                          onChange={() => handleOwnershipItemChange('backupOwner', userType)}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">{userType}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Arrow */}
                            <div className="flex items-center justify-center">
                              <ArrowRight className="h-5 w-5 text-gray-400" />
                            </div>
                            
                            {/* Custodian Box */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex-1 relative dropdown-container">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Custodian</h4>
                              <button
                                onClick={() => toggleDropdown('custodian')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-left flex items-center justify-between bg-white"
                              >
                                <span className="text-sm text-gray-700">
                                  {ownershipItems.custodian.length === 0 
                                    ? 'Select options...' 
                                    : `${ownershipItems.custodian.length} selected`
                                  }
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen.custodian ? 'rotate-180' : ''}`} />
                              </button>
                              
                              {dropdownOpen.custodian && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                                  <div className="p-2 space-y-1">
                                    {userTypes.map((userType) => (
                                      <label key={userType} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ownershipItems.custodian.includes(userType)}
                                          onChange={() => handleOwnershipItemChange('custodian', userType)}
                                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">{userType}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Arrow */}
                            <div className="flex items-center justify-center">
                              <ArrowRight className="h-5 w-5 text-gray-400" />
                            </div>
                            
                            {/* End User/SME Box */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex-1 relative dropdown-container">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">End User/SME</h4>
                              <button
                                onClick={() => toggleDropdown('endUserSME')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-left flex items-center justify-between bg-white"
                              >
                                <span className="text-sm text-gray-700">
                                  {ownershipItems.endUserSME.length === 0 
                                    ? 'Select options...' 
                                    : `${ownershipItems.endUserSME.length} selected`
                                  }
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen.endUserSME ? 'rotate-180' : ''}`} />
                              </button>
                              
                              {dropdownOpen.endUserSME && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                                  <div className="p-2 space-y-1">
                                    {userTypes.map((userType) => (
                                      <label key={userType} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ownershipItems.endUserSME.includes(userType)}
                                          onChange={() => handleOwnershipItemChange('endUserSME', userType)}
                                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">{userType}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {section.id === 'security' && (
                        <div className="space-y-4 ml-4">
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="pamIntegration"
                                checked={securityItems.pamIntegration}
                                onChange={() => handleSecurityItemChange('pamIntegration')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="pamIntegration" className="ml-3 text-sm font-medium text-gray-700">
                                Integration with PAM for pwd rotation
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="jitAccess"
                                checked={securityItems.jitAccess}
                                onChange={() => handleSecurityItemChange('jitAccess')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="jitAccess" className="ml-3 text-sm font-medium text-gray-700">
                                JIT Access Provisioning
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      {section.id === 'lifecycle' && (
                        <div className="text-center py-12">
                          <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Lifecycle Section</h3>
                          <p className="text-gray-600">Manage configuration lifecycle and updates here.</p>
                        </div>
                      )}
                      {section.id === 'attributes' && (
                        <div className="space-y-6 ml-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="accountType"
                                checked={attributeItems.accountType}
                                onChange={() => handleAttributeItemChange('accountType')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="accountType" className="ml-3 text-sm font-medium text-gray-700">
                                accountType
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="ownerCustodianUserId"
                                checked={attributeItems.ownerCustodianUserId}
                                onChange={() => handleAttributeItemChange('ownerCustodianUserId')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="ownerCustodianUserId" className="ml-3 text-sm font-medium text-gray-700">
                                ownerCustodianUserId
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="backupOwnerId"
                                checked={attributeItems.backupOwnerId}
                                onChange={() => handleAttributeItemChange('backupOwnerId')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="backupOwnerId" className="ml-3 text-sm font-medium text-gray-700">
                                backupOwnerId
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="businessService"
                                checked={attributeItems.businessService}
                                onChange={() => handleAttributeItemChange('businessService')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="businessService" className="ml-3 text-sm font-medium text-gray-700">
                                businessService
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="environment"
                                checked={attributeItems.environment}
                                onChange={() => handleAttributeItemChange('environment')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="environment" className="ml-3 text-sm font-medium text-gray-700">
                                environment
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="rotationPolicy"
                                checked={attributeItems.rotationPolicy}
                                onChange={() => handleAttributeItemChange('rotationPolicy')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="rotationPolicy" className="ml-3 text-sm font-medium text-gray-700">
                                rotationPolicy
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="pamPolicyRef"
                                checked={attributeItems.pamPolicyRef}
                                onChange={() => handleAttributeItemChange('pamPolicyRef')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="pamPolicyRef" className="ml-3 text-sm font-medium text-gray-700">
                                pamPolicyRef
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="smeUsers"
                                checked={attributeItems.smeUsers}
                                onChange={() => handleAttributeItemChange('smeUsers')}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="smeUsers" className="ml-3 text-sm font-medium text-gray-700">
                                SME Users
                              </label>
                            </div>
                            
                            {/* Custom Attributes */}
                            {customAttributes.map((attr, index) => (
                              <div key={`custom-${index}`} className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`custom-${index}`}
                                  checked={true}
                                  readOnly
                                  className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                />
                                <label htmlFor={`custom-${index}`} className="ml-3 text-sm font-medium text-gray-700">
                                  {attr}
                                </label>
                                <button
                                  onClick={() => removeCustomAttribute(index)}
                                  className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                  title="Remove custom attribute"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          {/* Custom Attribute Input */}
                          <div className="mt-6 pt-4 border-t border-gray-200">
                            <label htmlFor="customAttribute" className="block text-sm font-medium text-gray-700 mb-2">
                              Custom Attribute
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                id="customAttribute"
                                value={customAttribute}
                                onChange={(e) => setCustomAttribute(e.target.value)}
                                placeholder="Enter custom attribute name"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                onKeyPress={(e) => e.key === 'Enter' && addCustomAttribute()}
                              />
                              <button
                                onClick={addCustomAttribute}
                                disabled={!customAttribute.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Add
                              </button>
                            </div>
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
    </div>
  );
}



