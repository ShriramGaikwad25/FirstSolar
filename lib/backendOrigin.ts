import { BASE_PATH } from "@/lib/basePath";

/** Backend used by `npm run dev` (localhost has no KeyForge services). */
export const DEV_BACKEND_ORIGIN = "https://preview.keyforge.ai";

/**
 * Origin of the KeyForge backend services (/entities, /workflow, /catalog, ...).
 * Production: the same host the user typed, without the /kfidp UI prefix:
 *   UI  https://ispm.example.com/kfidp/dashboard  ->  API  https://ispm.example.com/entities/...
 * Development (`npm run dev`): DEV_BACKEND_ORIGIN.
 */
export function getBackendOrigin(): string {
  if (process.env.NODE_ENV === "development") return DEV_BACKEND_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * Dev only: route some calls through the app's own /kfidp/api/* proxies, because the dev backend
 * (DEV_BACKEND_ORIGIN) is another origin and the browser would block it (CORS). In production the
 * backend is the same origin, so the browser calls it directly and the proxies are not used.
 */
export const USE_SERVER_PROXY = process.env.NODE_ENV === "development";

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
