'use client';

import { useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
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

  // Real routes always win over [tenantId], so a reserved segment that lands here has no page
  // (e.g. a bookmark to a removed section) — show the 404 instead of treating it as a tenant.
  if (isReservedPathSegment(tenantId)) {
    notFound();
  }

  return <TenantLoginForm tenantId={tenantId} />;
}
