import appConfig from "@/config.json";

/**
 * Default tenant when redirecting legacy /login → /{tenantId}.
 * Sign-in URLs: /ACMECOM, /KFPRODOCI (tenant in path, not config).
 */
export const tenantId = appConfig.tenantId ?? "";

// Application configuration
export const config = {
  tenantId,
  api: {
    endpoints: {
      jobs: tenantId
        ? `https://preview.keyforge.ai/kfscheduler/api/v1/${tenantId}/jobs`
        : "",
    },
  },
};
