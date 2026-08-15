'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoggedOutView } from '@/components/LoggedOutView';
import { TenantLoginForm } from '@/components/TenantLoginForm';
import { isReservedPathSegment, setActiveTenantId } from '@/lib/tenant';

/**
 * Tenant sign-in entry: /ACMECOM, /KFPRODOCI
 * LOCAL → username/password form; OAUTH → SSO redirect via AuthContext.
 */
export default function TenantAuthPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params.tenantId ?? '').trim();

  useEffect(() => {
    if (!tenantId) return;
    if (tenantId.toLowerCase() === 'logged-out') {
      router.replace('/logged-out');
      return;
    }
    if (!isReservedPathSegment(tenantId)) {
      setActiveTenantId(tenantId);
    }
  }, [tenantId, router]);

  if (!tenantId) {
    return null;
  }

  if (tenantId.toLowerCase() === 'logged-out') {
    return <LoggedOutView />;
  }

  if (isReservedPathSegment(tenantId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <TenantLoginForm tenantId={tenantId} />;
}
