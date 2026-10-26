// Authentication API endpoints and utilities
import { getBackendOrigin, USE_SERVER_PROXY } from "@/lib/backendOrigin";
import { withBasePath } from "@/lib/basePath";
import {
  clearActiveTenantId,
  getActiveTenantId,
  getTenantLoginPath,
  REGISTERED_APP_COOKIE,
  redirectToTenantLogin,
} from '@/lib/tenant';
import { clearJitAccessHistoryStore } from '@/lib/jitAccessHistoryStorage';
import { setHttpOnlySession, TOKEN_PLACEHOLDER, usesHttpOnlySession } from '@/lib/kfProxy';
import appConfig from '@/config.json';

/** Best-effort message from KeyForge / gateway / PG JSON error bodies. */
function pickHttpErrorBodyMessage(errorJson: unknown, fallback: string): string {
  if (typeof errorJson === "string" && errorJson.trim()) return errorJson.trim();
  if (errorJson == null || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return fallback;
  }
  const o = errorJson as Record<string, unknown>;
  const nested =
    o.error && typeof o.error === "object" && !Array.isArray(o.error)
      ? (o.error as Record<string, unknown>)
      : null;
  const candidates: unknown[] = [
    o.message,
    o.error,
    o.detail,
    o.title,
    o.description,
    o.statusMessage,
    o.exceptionMessage,
    nested?.message,
    nested?.detail,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  try {
    const s = JSON.stringify(o);
    if (s && s.length < 1200) return s;
  } catch {
    // ignore
  }
  return fallback;
}

const authBaseUrl = () => `${getBackendOrigin()}/RequestJWTToken/TokenProvider`;

export const AUTH_SESSION_KEYS = {
  AUTH_TYPE: 'kf_auth_type',
  AUTH_METHOD: 'kf_auth_method',
  LOGOUT_URL: 'kf_logout_url',
  /** Survives clearAllAuthCookies so logout can detect SSO vs LOCAL. */
  LAST_AUTH_TYPE: 'kf_last_auth_type',
  /** Set before navigation so AuthWrapper does not redirect to tenant login mid-logout. */
  LOGOUT_REDIRECT: 'kf_logout_redirect',
  /** Set when user signed in via SSO (OAUTH/IDCS); used to route logout to /logged-out. */
  USES_EXTERNAL_AUTH: 'kf_uses_external_auth',
  OAUTH_CALLBACK_FAILED: 'kf_oauth_callback_failed',
  OAUTH_REDIRECT_AT: 'kf_oauth_redirect_at',
} as const;

export interface ApplicationAuthTypeResponse {
  OAuthRequestURL?: string;
  STATUS?: string;
  logoutURL?: string;
  AuthType?: string;
  AuthMethod?: string;
  status?: string;
}

export interface TokenResponse {
  tokenResponse: {
    userUniqueID: string;
    userAdminRoles: string;
    accessToken: string;
    statusMessage: string;
    status: string;
  };
  statusMessage: string;
  status: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  expiresAt?: number;
  userId?: string;
  tenantId?: string;
}

export interface JWTTokenResponse {
  jwtToken?: string;
  token?: string;
  tokenResponse?: {
    jwtToken?: string;
    token?: string;
  };
  data?: {
    jwtToken?: string;
    token?: string;
  };
  expiresIn?: number;
}

// Cookie management utilities
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',  // Master token - long-lived, used to generate new JWT tokens
  UID_TENANT: 'uidTenant',      // User information (userid, tenantId)
  JWT_TOKEN: 'jwtToken',        // Short-lived JWT token - used for API calls in Authorization header
  REVIEWER_ID: 'reviewerId',    // User unique ID used as reviewerId throughout the application
  USER_ADMIN_ROLES: 'userAdminRoles',  // Legacy: no longer set or read; kept so login and logout clear old copies
} as const;

export function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Encode the value to handle special characters
  const encodedValue = encodeURIComponent(value);
  
  // Build cookie string with security attributes
  // Use secure flag only in production (HTTPS)
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureFlag = isSecure ? ';secure' : '';
  
  // Set cookie with proper attributes
  document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;samesite=strict${secureFlag}`;
}

/** A cookie JS can read, or null. Token cookies are HttpOnly, so this never returns a session token. */
function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const nameEQ = name + '=';
  const ca = document.cookie.split(';');

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      // Decode the value to handle special characters
      const value = c.substring(nameEQ.length, c.length);
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Reads a cookie. accessToken / jwtToken are HttpOnly cookies JS cannot read: in a signed-in
 * session they read as a placeholder, which callers attach as `Authorization: Bearer` exactly as
 * before and the fetch layer swaps for the real token on the server (lib/kfProxy.ts).
 */
export function getCookie(name: string): string | null {
  const value = readBrowserCookie(name);
  if (value || !usesHttpOnlySession()) return value;
  if (name === COOKIE_NAMES.ACCESS_TOKEN) return TOKEN_PLACEHOLDER.access;
  if (name === COOKIE_NAMES.JWT_TOKEN) return TOKEN_PLACEHOLDER.jwt;
  return null;
}

/** Cookie names a session token may be readable under: written by an older build, or by some SSO sign-ins. */
const READABLE_TOKEN_COOKIES = [
  COOKIE_NAMES.ACCESS_TOKEN,
  'access_token',
  'AccessToken',
  'ACCESS_TOKEN',
  COOKIE_NAMES.JWT_TOKEN,
  'jwt_token',
  'JwtToken',
  'JWT_TOKEN',
] as const;

/**
 * Moves session tokens JS can still read into HttpOnly cookies (server-side), so none stays
 * exposed to page scripts. True when there was one to move.
 */
export async function secureReadableTokenCookies(): Promise<boolean> {
  if (!READABLE_TOKEN_COOKIES.some((name) => readBrowserCookie(name))) return false;
  try {
    const res = await fetch(withBasePath('/api/auth/secure-cookies'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Claims of the session's JWT (user id, roles, tenant), as decoded by the server. */
export interface SessionClaims {
  userid?: string;
  adminRoles?: string[] | string;
  [key: string]: unknown;
}

// In-memory only, never persisted: the JWT is an HttpOnly cookie the page cannot decode, so the
// server hands its claims over with /api/auth/session, sign-in and refresh.
let sessionClaims: SessionClaims | null = null;
const sessionClaimsListeners = new Set<() => void>();

export function setSessionClaims(claims: SessionClaims | null | undefined): void {
  sessionClaims = claims && typeof claims === 'object' ? claims : null;
  sessionClaimsListeners.forEach((listener) => listener());
}

export function getSessionClaims(): SessionClaims | null {
  return sessionClaims;
}

/** Calls `listener` whenever the session claims change; returns the unsubscribe function. */
export function subscribeSessionClaims(listener: () => void): () => void {
  sessionClaimsListeners.add(listener);
  return () => {
    sessionClaimsListeners.delete(listener);
  };
}

export type ServerSessionCheck = {
  authenticated: boolean;
  hasAccessToken: boolean;
  hasJwtToken: boolean;
  user: { email?: string; tenantId?: string; userid?: string } | null;
  /** The JWT's claims; only for an authenticated session. */
  claims?: SessionClaims | null;
};

/** Uses /api/auth/session so HttpOnly cookies set by Keyforge are detected. */
export async function fetchServerSession(): Promise<ServerSessionCheck> {
  if (typeof window === 'undefined') {
    return {
      authenticated: false,
      hasAccessToken: false,
      hasJwtToken: false,
      user: null,
    };
  }
  try {
    const response = await fetch(withBasePath('/api/auth/session'), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        authenticated: false,
        hasAccessToken: false,
        hasJwtToken: false,
        user: null,
      };
    }
    return (await response.json()) as ServerSessionCheck;
  } catch {
    return {
      authenticated: false,
      hasAccessToken: false,
      hasJwtToken: false,
      user: null,
    };
  }
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const expired = 'Thu, 01 Jan 1970 00:00:00 UTC';
  document.cookie = `${name}=;expires=${expired};path=/;`;
  document.cookie = `${name}=;expires=${expired};path=/;secure;`;
  document.cookie = `${name}=;expires=${expired};path=/;samesite=strict;`;
  document.cookie = `${name}=;expires=${expired};path=/;samesite=strict;secure;`;
}

/** All cookie names used by auth (for client + server logout). */
export const AUTH_COOKIE_NAMES_TO_CLEAR = [
  ...Object.values(COOKIE_NAMES),
  ...READABLE_TOKEN_COOKIES,
  REGISTERED_APP_COOKIE,
] as const;

function getBrowserCookieNames(): string[] {
  if (typeof document === 'undefined') return [];
  return document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name): name is string => !!name);
}

function clearAuthSessionStorage(preserveLogoutRedirect = false): void {
  if (typeof window === 'undefined') return;
  const keepRedirect = preserveLogoutRedirect
    ? sessionStorage.getItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT)
    : null;
  const keepExternal = preserveLogoutRedirect
    ? sessionStorage.getItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH)
    : null;
  const keys = [
    AUTH_SESSION_KEYS.AUTH_TYPE,
    AUTH_SESSION_KEYS.AUTH_METHOD,
    AUTH_SESSION_KEYS.LOGOUT_URL,
    AUTH_SESSION_KEYS.LAST_AUTH_TYPE,
    AUTH_SESSION_KEYS.OAUTH_CALLBACK_FAILED,
    AUTH_SESSION_KEYS.OAUTH_REDIRECT_AT,
    'kf_active_tenant',
  ];
  for (const key of keys) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  if (preserveLogoutRedirect) {
    try {
      if (keepRedirect) {
        sessionStorage.setItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT, keepRedirect);
      }
      if (keepExternal) {
        sessionStorage.setItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH, keepExternal);
      }
    } catch {
      /* ignore */
    }
  }
}

export function markUsesExternalAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH, '1');
  } catch {
    /* ignore */
  }
}

export function hadExternalAuthSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH) === '1';
  } catch {
    return false;
  }
}

/** Clears every auth-related and visible browser cookie, plus auth session keys. */
export function clearAllAuthCookies(options?: { preserveLogoutRedirect?: boolean }): void {
  const preserveLogoutRedirect = options?.preserveLogoutRedirect ?? false;

  const names = new Set<string>([...AUTH_COOKIE_NAMES_TO_CLEAR]);
  for (const name of getBrowserCookieNames()) {
    names.add(name);
  }

  for (const name of names) {
    deleteCookie(name);
  }

  setHttpOnlySession(false);
  setSessionClaims(null);
  clearActiveTenantId();
  clearAuthSessionStorage(preserveLogoutRedirect);
  clearPersistedApplicationAuthType();
}

/** Server logout API — clears HttpOnly cookies the browser JS cannot remove. */
export async function clearAuthCookiesOnServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(withBasePath('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    /* ignore */
  }
}

// Force logout when tokens fail - clears cookies and redirects to login
export function forceLogout(reason?: string): void {
  console.error('🚨 FORCE LOGOUT TRIGGERED 🚨:', reason || 'Token verification/generation failed');

  void clearAuthCookiesOnServer();
  try {
    clearAllAuthCookies();
    console.log('Cookies cleared');
  } catch (e) {
    console.error('Error clearing cookies:', e);
  }

  try {
    clearJitAccessHistoryStore();
  } catch {
    /* ignore */
  }
  
  redirectToTenantLogin();
}

// Check if response contains token expired error and attempt refresh before logout
export async function checkTokenExpiredError(data: any): Promise<boolean> {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check for the exact pattern: {"status":"error","errorMessage":"Token Expired"}
  const status = data.status || data.Status || data.STATUS;
  const errorMessage = data.errorMessage || data.error_message || data.errorMessage || data.ErrorMessage;

  if (status === 'error' && errorMessage) {
    const errorMsgStr = String(errorMessage).trim();
    if (errorMsgStr === 'Token Expired' || errorMsgStr.toLowerCase() === 'token expired') {
      console.error('🚨 TOKEN EXPIRED ERROR DETECTED - ATTEMPTING TO REFRESH 🚨');
      
      // Try to refresh JWT token using access token before logging out
      const refreshSuccess = await refreshJWTToken();
      
      if (refreshSuccess) {
        console.log('✅ JWT token refreshed successfully');
        return false; // Token was refreshed, not expired anymore
      } else {
        // Refresh failed - access token is also expired/invalid, logout
        console.error('🚨 TOKEN REFRESH FAILED - FORCING LOGOUT 🚨');
        clearAllAuthCookies();
        forceLogout('Token Expired - Refresh failed');
        redirectToTenantLogin();
        return true;
      }
    }
  }

  return false;
}

/** Tenant from URL path or cookie only (e.g. /KFPRODOCI). Not used for standard /login. */
function registeredAppNameOrNull(): string | null {
  return getActiveTenantId()?.trim() || null;
}

/** AuthType from applicationType API (defaults to LOCAL when missing). */
export function getApplicationAuthType(
  response: ApplicationAuthTypeResponse | null | undefined
): string {
  if (response == null || typeof response !== 'object') return 'LOCAL';
  const r = response as Record<string, unknown>;
  const authType = String(
    r.AuthType ?? r.authType ?? r.AUTH_TYPE ?? r.auth_type ?? ''
  )
    .trim()
    .toUpperCase();
  if (authType) return authType;

  const authMethod = String(r.AuthMethod ?? r.authMethod ?? '')
    .trim()
    .toUpperCase();
  if (authMethod === 'NATIVE') return 'LOCAL';
  if (authMethod) return 'OAUTH';

  return 'LOCAL';
}

/** verifyToken is only for LOCAL username/password sessions. */
export function shouldVerifyAccessToken(explicitAuthType?: string | null): boolean {
  const authType = String(explicitAuthType ?? getPersistedAuthType() ?? '')
    .trim()
    .toUpperCase();
  return authType === '' || authType === 'LOCAL';
}

export function isLocalApplicationAuth(
  response: ApplicationAuthTypeResponse | null | undefined
): boolean {
  return getApplicationAuthType(response) === 'LOCAL';
}

/** True for any non-LOCAL AuthType (OAUTH, IDCS, SAML, etc.) — uses external/SSO flow. */
export function usesExternalAuthFlow(
  response: ApplicationAuthTypeResponse | null | undefined
): boolean {
  return !isLocalApplicationAuth(response);
}

/** @deprecated Use usesExternalAuthFlow() — kept for callers expecting this name. */
export function isOAuthApplicationAuth(
  response: ApplicationAuthTypeResponse | null | undefined
): boolean {
  return usesExternalAuthFlow(response);
}

export function getOAuthRequestUrl(
  response: ApplicationAuthTypeResponse | null | undefined
): string | null {
  const url = String(response?.OAuthRequestURL ?? '').trim();
  return url || null;
}

export function markOAuthRedirectAttempt(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_SESSION_KEYS.OAUTH_REDIRECT_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Prevents redirect loops to identity.keyforge.ai / IdP when callback failed or cookies not on app origin. */
export function shouldRedirectToOAuthProvider(oauthUrl: string | null): boolean {
  if (!oauthUrl?.trim()) return false;
  if (typeof window === 'undefined') return false;
  if (getOAuthCallbackParamsFromUrl()) return false;

  try {
    if (sessionStorage.getItem(AUTH_SESSION_KEYS.OAUTH_CALLBACK_FAILED) === '1') {
      return false;
    }
    const lastRedirect = sessionStorage.getItem(AUTH_SESSION_KEYS.OAUTH_REDIRECT_AT);
    if (lastRedirect && Date.now() - Number(lastRedirect) < 20_000) {
      return false;
    }
  } catch {
    /* ignore */
  }

  try {
    const target = new URL(oauthUrl, window.location.href);
    if (target.origin === window.location.origin) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/** OAuth authorization code + state returned on the app redirect URI. */
export function getOAuthCallbackParamsFromUrl(
  search?: string
): { code: string; state: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(search ?? window.location.search);
  const code = params.get('code')?.trim();
  const state = params.get('state')?.trim();
  if (!code || !state) return null;
  return { code, state };
}

/** @deprecated Use getOAuthCallbackParamsFromUrl() instead. */
export function shouldSkipOAuthRedirect(): boolean {
  return getOAuthCallbackParamsFromUrl() !== null;
}

export function clearOAuthCallbackParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const qs = url.searchParams.toString();
  window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
}

/** What a sign-in returns to the page: the user's ids and the JWT's claims; the tokens are HttpOnly cookies. */
export type SignInResult = {
  userUniqueID?: string;
  userid?: string;
  claims?: SessionClaims | null;
};

async function readSignInResponse(response: Response, label: string): Promise<SignInResult> {
  const rawText = await response.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}): ${rawText.slice(0, 200)}`);
  }
  if (!response.ok || data?.status === 'failed' || data?.status === 'error' || data?.STATUS === 'FAILED') {
    throw new Error(
      String(data?.statusMessage ?? data?.STATUSMESSAGE ?? (rawText || `${label} failed (${response.status})`))
    );
  }
  const text = (key: string) => (typeof data?.[key] === 'string' && (data[key] as string).trim()) || undefined;
  const claims = data?.claims && typeof data.claims === 'object' ? (data.claims as SessionClaims) : null;
  return { userUniqueID: text('userUniqueID'), userid: text('userid'), claims };
}

/**
 * Exchange the OAuth authorization code on the server, which stores the tokens as HttpOnly cookies.
 * Always via our route (also with a same-origin backend): a direct call would hand the token to page JS.
 */
export async function completeOAuthCallback(code: string, state: string): Promise<SignInResult> {
  const params = new URLSearchParams({ code, state });
  const tenant = registeredAppNameOrNull();
  if (tenant) params.set('registeredAppName', tenant);
  const response = await fetch(withBasePath(`/api/auth/oauth/callback?${params.toString()}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return readSignInResponse(response, 'OAuth callback');
}

/** Password sign-in on the server, which stores the tokens as HttpOnly cookies. */
export async function signInWithPassword(
  userid: string,
  password: string,
  tenantId: string
): Promise<SignInResult> {
  const response = await fetch(withBasePath('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, password, tenantId }),
    cache: 'no-store',
  });
  return readSignInResponse(response, 'Sign-in');
}

/**
 * Records the signed-in user after a password or OAuth sign-in. The tokens are already HttpOnly
 * cookies set by the server; this keeps only the readable, non-secret ids and the claims in memory.
 */
export function establishAuthenticatedSession(options: SignInResult & { tenantId?: string }): void {
  const { userUniqueID, userid, claims, tenantId } = options;
  const resolvedTenantId = tenantId?.trim() || registeredAppNameOrNull() || '';

  setCookie(
    COOKIE_NAMES.UID_TENANT,
    JSON.stringify({
      userid: userid ?? userUniqueID ?? '',
      tenantId: resolvedTenantId,
    })
  );

  // reviewerId and admin roles are never written to cookies: they come from the JWT's claims
  // (see getReviewerId/getUserAdminRoles). Clear a role cookie left by an older build.
  deleteCookie(COOKIE_NAMES.USER_ADMIN_ROLES);
  setSessionClaims(claims);
  setHttpOnlySession(true);
}

/** After SSO redirect: tokens are already in cookies — restore state only, no token APIs. */
export function restoreExternalAuthFromExistingCookies(
  authType: string
): { authenticated: boolean; user: { email: string; tenantId?: string } | null } {
  persistApplicationAuthType({ AuthType: authType, status: 'success' });
  clearOAuthCallbackParamsFromUrl();
  return restoreSessionFromCookies();
}

export function persistApplicationAuthType(response: ApplicationAuthTypeResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const authType = getApplicationAuthType(response);
    const authMethod = String(response.AuthMethod ?? '');
    sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_TYPE, authType);
    sessionStorage.setItem(AUTH_SESSION_KEYS.LAST_AUTH_TYPE, authType);
    sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_METHOD, authMethod);
    if (response.logoutURL?.trim()) {
      sessionStorage.setItem(AUTH_SESSION_KEYS.LOGOUT_URL, response.logoutURL.trim());
    }
    if (isExternalAuthType(authType, authMethod)) {
      markUsesExternalAuth();
    }
  } catch {
    /* ignore */
  }
}

export function syncAuthTypeToSession(authType: string, authMethod?: string): void {
  if (typeof window === 'undefined') return;
  const t = String(authType).trim().toUpperCase();
  if (!t) return;
  try {
    sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_TYPE, t);
    sessionStorage.setItem(AUTH_SESSION_KEYS.LAST_AUTH_TYPE, t);
    if (authMethod != null) {
      sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_METHOD, String(authMethod));
    }
    if (isExternalAuthType(t, authMethod)) {
      markUsesExternalAuth();
    } else if (t === 'LOCAL') {
      sessionStorage.removeItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH);
    }
  } catch {
    /* ignore */
  }
}

export function getPersistedAuthMethod(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEYS.AUTH_METHOD);
  } catch {
    return null;
  }
}

/** Auth type/method for logout routing (read before clearAllAuthCookies). */
export function resolveAuthTypeForLogout(reactAuthType?: string | null): string | null {
  if (hadExternalAuthSession()) return 'OAUTH';
  const fromPersisted = getPersistedAuthType();
  if (fromPersisted && fromPersisted !== 'LOCAL') return fromPersisted;
  if (reactAuthType && reactAuthType !== 'LOCAL') return reactAuthType;
  try {
    const last = sessionStorage.getItem(AUTH_SESSION_KEYS.LAST_AUTH_TYPE)?.trim();
    if (last && last !== 'LOCAL') return last;
  } catch {
    /* ignore */
  }
  const method = getPersistedAuthMethod()?.trim().toUpperCase();
  if (method && method !== 'NATIVE') return 'OAUTH';
  return fromPersisted ?? reactAuthType ?? null;
}

export function shouldLogoutToLoggedOutPage(reactAuthType?: string | null): boolean {
  const authType = resolveAuthTypeForLogout(reactAuthType);
  return isExternalAuthType(authType, getPersistedAuthMethod()) || hadExternalAuthSession();
}

export function getPersistedAuthType(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEYS.AUTH_TYPE);
  } catch {
    return null;
  }
}

/** True for OAUTH / IDCS / SAML etc. — not LOCAL username/password. */
export function isExternalAuthType(
  authType: string | null | undefined,
  authMethod?: string | null
): boolean {
  const method = String(authMethod ?? getPersistedAuthMethod() ?? '')
    .trim()
    .toUpperCase();
  if (method === 'NATIVE') return false;
  if (method && method !== '') return true;

  const t = String(authType ?? '')
    .trim()
    .toUpperCase();
  return t !== '' && t !== 'LOCAL';
}

export function performUserLogout(
  reactAuthType?: string | null,
  tenantId?: string | null
): void {
  if (typeof window === 'undefined') return;

  const external = shouldLogoutToLoggedOutPage(reactAuthType);
  const target = external
    ? '/logged-out'
    : tenantId?.trim()
      ? `/${tenantId.trim()}`
      : getTenantLoginPath();

  try {
    if (external) {
      sessionStorage.setItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT, '/logged-out');
      markUsesExternalAuth();
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT);
      sessionStorage.removeItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH);
    }
  } catch {
    /* ignore */
  }

  clearAllAuthCookies({ preserveLogoutRedirect: external });
  try {
    clearJitAccessHistoryStore();
  } catch {
    /* ignore */
  }

  // Navigate immediately so AuthWrapper cannot redirect to tenant login first.
  window.location.replace(withBasePath(target));

  void clearAuthCookiesOnServer();
}

export function clearLogoutRedirectFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT);
    sessionStorage.removeItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH);
  } catch {
    /* ignore */
  }
}

export function isLogoutRedirectPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT) === '/logged-out';
  } catch {
    return false;
  }
}

export function clearPersistedApplicationAuthType(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEYS.AUTH_TYPE);
    sessionStorage.removeItem(AUTH_SESSION_KEYS.AUTH_METHOD);
    sessionStorage.removeItem(AUTH_SESSION_KEYS.LOGOUT_URL);
    // LAST_AUTH_TYPE intentionally kept for logout routing
  } catch {
    /* ignore */
  }
}

export function clearLastAuthTypeOnLocalLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_SESSION_KEYS.LAST_AUTH_TYPE, 'LOCAL');
    sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_TYPE, 'LOCAL');
    sessionStorage.setItem(AUTH_SESSION_KEYS.AUTH_METHOD, 'NATIVE');
    sessionStorage.removeItem(AUTH_SESSION_KEYS.LOGOUT_REDIRECT);
    sessionStorage.removeItem(AUTH_SESSION_KEYS.USES_EXTERNAL_AUTH);
  } catch {
    /* ignore */
  }
}

/** Resolves tenant auth mode (LOCAL vs OAUTH) for the configured registered app name. */
export async function fetchApplicationAuthType(
  registeredApp?: string
): Promise<ApplicationAuthTypeResponse> {
  const appName = (registeredApp ?? registeredAppNameOrNull() ?? '').trim();
  if (!appName) {
    throw new Error('Tenant is required for applicationType');
  }
  const useProxy = typeof window !== 'undefined' && USE_SERVER_PROXY;
  const response = useProxy
    ? await fetch(withBasePath('/api/auth/application-type'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registeredAppName: appName }),
        cache: 'no-store',
      })
    : await fetch(`${authBaseUrl()}/applicationType`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': appName },
        body: JSON.stringify({ registeredAppName: appName }),
        cache: 'no-store',
      });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `applicationType failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = (await response.json()) as ApplicationAuthTypeResponse;
  const status = String(data.status ?? data.STATUS ?? '').trim().toLowerCase();
  if (status && status !== 'success') {
    throw new Error(`applicationType returned status: ${status}`);
  }

  persistApplicationAuthType(data);
  return data;
}

/**
 * Disabled: SSO and startup flows restore sessions from cookies only.
 * Kept for API compatibility — never calls the network.
 */
export async function verifyToken(
  _accessToken: string,
  _options?: { authType?: string | null }
): Promise<VerifyTokenResponse> {
  return { valid: true };
}

// Helper function to extract JWT token from response
export function extractJWTToken(jwtResponse: JWTTokenResponse): string | null {
  return jwtResponse.jwtToken 
    || jwtResponse.token 
    || jwtResponse.tokenResponse?.jwtToken 
    || jwtResponse.tokenResponse?.token
    || jwtResponse.data?.jwtToken
    || jwtResponse.data?.token
    || null;
}

/**
 * Issues a fresh JWT on the server from the session's access token (both HttpOnly cookies).
 * False when the access token is gone or expired: the caller decides whether to log out.
 */
export async function refreshJWTToken(): Promise<boolean> {
  try {
    const tenant = resolveTenantIdForHeader();
    const response = await fetch(withBasePath('/api/auth/refresh'), {
      method: 'POST',
      headers: tenant ? { 'X-Tenant-Id': tenant } : undefined,
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error('JWT token refresh failed:', response.status);
      return false;
    }
    const data = (await response.json().catch(() => null)) as { claims?: SessionClaims | null } | null;
    // Keep reviewerId / roles / tenant in sync with the refreshed token's claims.
    if (data?.claims) setSessionClaims(data.claims);
    return true;
  } catch (error) {
    console.error('JWT token refresh failed:', error);
    return false;
  }
}

// Enhanced API request with automatic token refresh:
// - On 401/403 or response body "Token Expired" -> try refresh JWT using access token
// - On refresh success -> retry request once
// - On refresh failure (access token expired) -> forceLogout
/** Resolves the current tenant id (path segment / session -> stored user). Use this instead of hardcoding a tenant literal. */
export function resolveTenantIdForHeader(): string {
  return getActiveTenantId()?.trim() || getCurrentUser()?.tenantId?.trim() || '';
}

/** Auth + tenant headers for call sites that use raw fetch() instead of apiRequestWithAuth (e.g. non-JSON responses). */
export function getJwtAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
  return {
    ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
    'X-Tenant-Id': resolveTenantIdForHeader(),
    ...extra,
  };
}

/** Same as getJwtAuthHeaders but authorizes with the master access token (registerscimapp/schemamapper-style APIs). */
export function getAccessTokenAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    'X-Tenant-Id': resolveTenantIdForHeader(),
    ...extra,
  };
}

export async function apiRequestWithAuth<T>(
  url: string,
  options: RequestInit = {},
  internalRetry = false
): Promise<T> {
  const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);

  if (!jwtToken) {
    forceLogout('No JWT token available');
    throw new Error('No JWT token available');
  }

  // For GET requests, don't include Content-Type header (some servers reject it)
  const isGetRequest = (options.method || 'GET').toUpperCase() === 'GET';
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${jwtToken}`,
    'X-Tenant-Id': resolveTenantIdForHeader(),
    ...(options.headers as Record<string, string>),
  };

  // Only add Content-Type for non-GET requests
  if (!isGetRequest && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If JWT token is expired or unauthorized, try to refresh it
    if (response.status === 401 || response.status === 403) {
      const refreshSuccess = await refreshJWTToken();
      
      if (refreshSuccess) {
        // Retry the request with the new token
        const newJwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
        const newHeaders = {
          ...headers,
          'Authorization': `Bearer ${newJwtToken}`,
        };

        const retryResponse = await fetch(url, {
          ...options,
          headers: newHeaders,
        });

        if (!retryResponse.ok) {
          // If retry still fails, logout
          if (retryResponse.status === 401 || retryResponse.status === 403) {
            forceLogout(`API request failed with status ${retryResponse.status} after token refresh`);
            throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        // Check retry response for error status
        const retryText = await retryResponse.text();
        let retryData: any;
        
        try {
          retryData = JSON.parse(retryText);
        } catch (e) {
          console.error('Failed to parse retry response as JSON');
          throw new Error('Invalid retry response format');
        }
        
        // Check if retry response has error status
        if (retryData && typeof retryData === 'object') {
          // Check for token expired error first
          if (await checkTokenExpiredError(retryData)) {
            throw new Error('Token Expired');
          }
          
          const retryStatus = retryData.status || retryData.Status || retryData.STATUS;
          if (retryStatus !== undefined && retryStatus !== null) {
            const retryStatusStr = String(retryStatus).toLowerCase().trim();
            console.log('Checking retry response status:', retryStatusStr);
            if (retryStatusStr === 'error' || retryStatusStr === 'failed' || retryStatusStr === 'unauthorized') {
              console.error('Retry response has error status, logging out');
              forceLogout(`JWT token status is ${retryStatusStr} in retry response`);
              throw new Error(`JWT token status is ${retryStatusStr}`);
            }
          }
          
          // Also check for error field in retry response
          if (retryData.error || retryData.Error) {
            console.error('Retry response contains error field, logging out');
            forceLogout('JWT token retry response contains error');
            throw new Error('JWT token retry response contains error');
          }
        }
        
        return retryData;
      } else {
        // Refresh failed - access token is expired/invalid, logout
        console.error('Token refresh failed in apiRequestWithAuth - logging out');
        forceLogout('Token refresh failed - access token expired');
        throw new Error('Authentication failed - please login again');
      }
    }

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText) as unknown;
            errorMessage = pickHttpErrorBodyMessage(errorJson, errorMessage);
          } catch {
            errorMessage = errorText || errorMessage;
          }
        }
      } catch {
        // keep default errorMessage
      }

      errorMessage = `[HTTP ${response.status}] ${errorMessage}`;

      if (response.status === 401 || response.status === 403) {
        forceLogout(`API request failed with status ${response.status}`);
      }

      throw new Error(errorMessage);
    }

    // First, read response as text to check for error status before parsing
    const responseText = await response.clone().text();
    console.log('Raw API Response text (first 500 chars):', responseText.substring(0, 500));
    
    // Parse response as JSON; some endpoints return plain text on success (e.g. scheduler POST /trigger)
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return (responseText === '' ? undefined : responseText) as T;
    }

    try {
      // Check for token expired in response body: refresh JWT using access token, then retry once; if refresh fails, logout
      if (data && typeof data === 'object') {
        const status = data.status || data.Status || data.STATUS;
        const errorMessage = data.errorMessage || data.error_message || data.ErrorMessage;
        const isTokenExpiredInBody = status === 'error' && errorMessage &&
          (String(errorMessage).trim() === 'Token Expired' || String(errorMessage).trim().toLowerCase() === 'token expired');
        if (isTokenExpiredInBody) {
          const refreshFailed = await checkTokenExpiredError(data);
          if (refreshFailed) throw new Error('Token Expired');
          if (!internalRetry) return apiRequestWithAuth<T>(url, options, true);
          forceLogout('Token Expired after retry');
          throw new Error('Token Expired');
        }
      }
      
      // Log the response for debugging
      console.log('API Response received:', data);
      console.log('Response structure:', {
        hasApplications: !!data?.Applications,
        applicationsType: typeof data?.Applications,
        isArray: Array.isArray(data?.Applications),
        hasStatus: 'status' in data,
        statusType: typeof data?.status,
        statusValue: data?.status
      });
      
      // Check if JWT token status is error - logout if so (must happen before returning)
      // Check multiple possible locations for status field
      console.log('Checking JWT response for error status. Full data:', JSON.stringify(data, null, 2));
      
      if (data && typeof data === 'object') {
        // Check status in multiple possible locations
        const status = data.status || data.Status || data.STATUS || 
                      (data.response && data.response.status) ||
                      (data.data && data.data.status) ||
                      (data.tokenResponse && data.tokenResponse.status);
        
        if (status !== undefined && status !== null) {
          const statusStr = String(status).toLowerCase().trim();
          console.log('JWT Status found:', statusStr, 'Type:', typeof status);
          
          if (statusStr === 'error' || statusStr === 'failed' || statusStr === 'unauthorized') {
            console.error('!!! JWT TOKEN STATUS IS ERROR - FORCING LOGOUT !!!');
            // Clear cookies immediately
            clearAllAuthCookies();
            // Force logout immediately - this will redirect
            forceLogout(`JWT token status is ${statusStr}`);
            // Don't continue - redirect should happen
            throw new Error(`JWT token status is ${statusStr}`);
          }
        }
        
        // Also check for error message or error field
        if (data.error || data.Error || data.message === 'error' || data.message === 'failed') {
          console.error('!!! JWT TOKEN RESPONSE CONTAINS ERROR - FORCING LOGOUT !!!');
          clearAllAuthCookies();
          forceLogout('JWT token response contains error');
          throw new Error('JWT token response contains error');
        }
        
        // Check response message for error indicators
        const message = data.message || data.Message || data.errorMessage || data.error_message;
        if (message && typeof message === 'string') {
          const msgLower = message.toLowerCase();
          if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('invalid') || msgLower.includes('unauthorized')) {
            console.error('!!! JWT TOKEN MESSAGE INDICATES ERROR - FORCING LOGOUT !!!');
            clearAllAuthCookies();
            forceLogout(`JWT token message indicates error: ${message}`);
            throw new Error(`JWT token message indicates error: ${message}`);
          }
        }
      }
      
      // Return as any to avoid type checking issues - don't validate structure
      return data as any;
    } catch (parseError) {
      // If JSON parsing fails, try to get the text response
      console.error('JSON parse error:', parseError);
      
      // Check if this is a status error that we threw
      if (parseError instanceof Error && parseError.message.includes('JWT token status')) {
        // Force logout was already called, just re-throw
        throw parseError;
      }
      
      try {
        const text = await response.text();
        console.error('Raw response text:', text.substring(0, 500));
        
        // Check if the text contains status error
        try {
          const parsed = JSON.parse(text);
          // Check for token expired error
          if (await checkTokenExpiredError(parsed)) {
            throw new Error('Token Expired');
          }
          if (parsed && typeof parsed === 'object') {
            const status = parsed.status;
            if (status !== undefined && status !== null) {
              const statusStr = String(status).toLowerCase();
              if (statusStr === 'error' || statusStr === 'failed') {
                console.error('JWT token status is error/failed in text response, logging out');
                forceLogout(`JWT token status is ${statusStr}`);
                throw new Error(`JWT token status is ${statusStr}`);
              }
            }
          }
        } catch {}

        try {
          return JSON.parse(text) as any;
        } catch {
          return text as T;
        }
      } catch (e) {
        console.error('Failed to parse as text or JSON:', e);
        throw new Error(`Invalid JSON response: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Check if user is authenticated based on cookies
export function isAuthenticated(): boolean {
  const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
  const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
  return !!(accessToken && jwtToken);
}

/** Restore session from cookies without calling verifyToken (external/SSO flows). */
export function restoreSessionFromCookies(): {
  authenticated: boolean;
  user: { email: string; tenantId?: string } | null;
} {
  if (!isAuthenticated()) {
    return { authenticated: false, user: null };
  }

  const stored = getCurrentUser() as { userid?: string; email?: string; tenantId?: string } | null;
  const email = String(stored?.email ?? stored?.userid ?? '').trim();

  return {
    authenticated: true,
    user: {
      email,
      tenantId: stored?.tenantId ?? registeredAppNameOrNull() ?? undefined,
    },
  };
}

// Get current user info from cookies
export function getCurrentUser(): { email?: string; tenantId?: string } | null {
  const uidTenant = getCookie(COOKIE_NAMES.UID_TENANT);
  if (!uidTenant) return null;
  
  try {
    return JSON.parse(uidTenant);
  } catch {
    return null;
  }
}

// reviewerId (the user's unique id) now lives in the JWT's "userid" claim (see getSessionClaims).
// Falls back to the legacy cookie for any session still relying on the old token-response field.
export function getReviewerId(): string | null {
  const fromJwt = sessionClaims?.userid;
  if (typeof fromJwt === 'string' && fromJwt.trim()) return fromJwt.trim();
  return getCookie(COOKIE_NAMES.REVIEWER_ID);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** TEMPORARY fallback (config.json `tenantUuid`) until the JWT carries the tenant UUID. Remove with the fallback in getTenantUuid(). */
const TEMP_FALLBACK_TENANT_UUID = (appConfig as { tenantUuid?: string }).tenantUuid?.trim() || '';
let warnedTenantUuidFallback = false;
const TENANT_UUID_CLAIMS =['tenantUuid', 'tenant_uuid', 'tenantGuid', 'tenant_id', 'tenantId', 'tid'];

/** Tenant UUID for DB functions that take a tenant_id uuid, read from the signed-in user's JWT claims. */
export function getTenantUuid(): string {
  for (const key of TENANT_UUID_CLAIMS) {
    const value = sessionClaims?.[key];
    if (typeof value === 'string' && UUID_PATTERN.test(value.trim())) return value.trim();
  }
  // TEMPORARY: remove once the backend adds the tenant UUID claim to the JWT.
  if (!warnedTenantUuidFallback) {
    warnedTenantUuidFallback = true;
    console.warn('Tenant UUID not found in JWT claims; using temporary fallback');
  }
  return TEMP_FALLBACK_TENANT_UUID;
}

// User role(s) live only in the JWT's "adminRoles" claim (an array), as decoded by the server.
// Never read from a cookie: a client-set cookie can't be trusted for authorization.
export function getUserAdminRoles(): string | null {
  const roles = sessionClaims?.adminRoles;
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.filter(Boolean).join(', ');
  }
  if (typeof roles === 'string' && roles.trim()) return roles.trim();
  return null;
}
