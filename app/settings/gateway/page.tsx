"use client";
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { Settings, FileText, Users, Shield, Mail, ShieldCheck, Lock, Search, GraduationCap, Brain, Bot, UserSearch, ArrowLeftRight, ListChecks, Cpu, Timer } from 'lucide-react';

export default function GatewaySettings() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const cards = [
    {
      id: 'general',
      title: 'General',
      subtitle: 'Core gateway configuration and global settings.',
      href: '/settings/gateway/general',
      icon: <Settings className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'custom-schema',
      title: 'Custom Schema Management',
      subtitle: 'Define and manage custom schemas for integrations.',
      href: '/settings/gateway/custom-schema',
      icon: <FileText className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'native-users',
      title: 'Manage Native Users',
      subtitle: 'Provisioning, lifecycle, and access for native users.',
      href: '/settings/gateway/native-users',
      icon: <Users className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'admin-roles',
      title: 'Admin Roles',
      subtitle: 'Configure and manage admin roles and privileges.',
      href: '/settings/gateway/admin-roles',
      icon: <Shield className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'email-templates',
      title: 'Email Templates',
      subtitle: 'Create and manage email templates for notifications.',
      href: '/settings/gateway/email-templates',
      icon: <Mail className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'sam',
      title: 'SAM',
      subtitle: 'Service Account Management settings and configuration.',
      href: '/settings/gateway/sam',
      icon: <ShieldCheck className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'training-lms',
      title: 'Setup Training/LMS System(s)',
      subtitle: 'Configure integration with training and learning management systems.',
      href: '/settings/gateway/training-lms',
      icon: <GraduationCap className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'entitlement-management',
      title: 'Entitlement Management',
      subtitle: 'Manage and configure entitlements and access permissions.',
      href: '/settings/gateway/entitlement-management',
      icon: <ShieldCheck className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'continuous-compliance-event-definitions',
      title: 'Continuous Compliance Event Definitions',
      subtitle: 'Define triggers for assurance events and access reviews.',
      href: '/settings/gateway/continuous-compliance-event-definitions',
      icon: <ListChecks className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'sla-escalation-policies',
      title: 'SLA & Escalation Policies',
      subtitle: 'Define response timelines, reminders, and escalation rules for compliance events.',
      href: '/settings/gateway/sla-escalation-policies',
      icon: <Timer className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'agent-task-library',
      title: 'Agent Task Library',
      subtitle: 'Browse reusable AI, ML, and internal workflow tasks.',
      href: '/settings/gateway/agent-task-library',
      icon: <Cpu className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'ai-insights-configuration',
      title: 'AI Insights Configuration',
      subtitle: 'Configure AI-driven access reviews, approvals, and workflow intelligence.',
      href: '/settings/gateway/ai-insights-configuration',
      icon: <Brain className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'nhi-settings',
      title: 'NHI Settings',
      subtitle: 'Lookup catalog and other non-human identity configuration.',
      href: '/settings/gateway/nhi-settings',
      icon: <Bot className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'lookup-custom-approvers',
      title: 'Lookup For Custom Approvers',
      subtitle: 'Define how custom approvers are resolved for workflows and policies.',
      href: '/settings/gateway/lookup-custom-approvers',
      icon: <UserSearch className="w-5 h-5 text-gray-600" />,
    },
    {
      id: 'transformation-provider',
      title: 'Transformation Provider',
      subtitle: 'Configure transformation providers for data and integration flows.',
      href: '/settings/gateway/transformation-provider',
      icon: <ArrowLeftRight className="w-5 h-5 text-gray-600" />,
    },
  ];

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return cards;
    return cards.filter(card => 
      card.title.toLowerCase().includes(query) ||
      card.subtitle.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="h-full p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Generic</h1>
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gateway settings..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setSelected(card.id);
                router.push(card.href);
              }}
              className={`text-left p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                selected === card.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-lg mr-3">
                  {card.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{card.title}</h3>
                  <p className="text-xs text-gray-500">{card.subtitle}</p>
                </div>
                {selected === card.id && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


