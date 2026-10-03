import { BASE_PATH } from "@/lib/basePath";

/** Backend used by `npm run dev` (localhost has no KeyForge services). */
export const DEV_BACKEND_ORIGIN = "https://preview.keyforge.ai";

/**
 * Optional build-time setting for hosts with no KeyForge backend on the same origin (e.g. Vercel):
 * NEXT_PUBLIC_BACKEND_ORIGIN=https://preview.keyforge.ai. Leave unset on the self-hosted server.
 */
const CONFIGURED_BACKEND_ORIGIN = (process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "").trim().replace(/\/+$/, "");

/**
 * Origin of the KeyForge backend services (/entities, /workflow, /catalog, ...):
 * 1. NEXT_PUBLIC_BACKEND_ORIGIN when set (e.g. Vercel);
 * 2. DEV_BACKEND_ORIGIN under `npm run dev`;
 * 3. otherwise the same host the user typed, without the /kfidp UI prefix:
 *    UI  https://ispm.example.com/kfidp/dashboard  ->  API  https://ispm.example.com/entities/...
 */
export function getBackendOrigin(): string {
  if (CONFIGURED_BACKEND_ORIGIN) return CONFIGURED_BACKEND_ORIGIN;
  if (process.env.NODE_ENV === "development") return DEV_BACKEND_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Server-side counterpart of the configured origin (same env var, read at runtime). */
export function getConfiguredBackendOrigin(): string {
  return CONFIGURED_BACKEND_ORIGIN;
}

/**
 * When the backend is another origin (dev, or NEXT_PUBLIC_BACKEND_ORIGIN set), route the calls the
 * browser may not make cross-origin (CORS) through the app's own /kfidp/api/* proxies. With a
 * same-origin backend (self-hosted production) the browser calls it directly and the proxies are unused.
 */
export const USE_SERVER_PROXY = process.env.NODE_ENV === "development" || Boolean(CONFIGURED_BACKEND_ORIGIN);

/** True for a request to the backend services (not the UI's own /kfidp pages and API routes). */
export function isBackendUrl(url: string): boolean {
  if (typeof window === "undefined") return false;
  let target: URL;
  try {
    target = new URL(url, window.location.href);
  } catch {
    return false;
  }
  if (target.origin !== getBackendOrigin()) return false;
  if (target.origin !== window.location.origin) return true;
  return target.pathname !== BASE_PATH && !target.pathname.startsWith(`${BASE_PATH}/`);
}
