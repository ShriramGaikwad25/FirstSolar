"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_GUARDRAIL_TENANT_ID,
  GUARDRAIL_TENANTS,
} from "@/lib/oci-guardrail-posture-data";
import type { GuardrailTenant } from "@/types/oci-guardrail-posture";

export function useOciGuardrailTenant() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tenantId = searchParams.get("tenant") ?? DEFAULT_GUARDRAIL_TENANT_ID;

  const tenant = useMemo(
    () => GUARDRAIL_TENANTS.find((t) => t.id === tenantId) ?? GUARDRAIL_TENANTS[0],
    [tenantId]
  );

  const setTenantId = useCallback(
    (nextTenantId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextTenantId) params.set("tenant", nextTenantId);
      else params.delete("tenant");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  return {
    tenantId: tenant?.id ?? DEFAULT_GUARDRAIL_TENANT_ID,
    tenant,
    tenants: GUARDRAIL_TENANTS as GuardrailTenant[],
    setTenantId,
  };
}
