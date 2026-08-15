// Authentication API endpoints and utilities
import {
  clearActiveTenantId,
  getActiveTenantId,
  getTenantLoginPath,
  REGISTERED_APP_COOKIE,
  redirectToTenantLogin,
} from '@/lib/tenant';
import { clearJitAccessHistoryStore } from '@/lib/jitAccessHistoryStorage';

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

const AUTH_BASE_URL = 'https://preview.keyforge.ai/RequestJWTToken/TokenProvider';

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
  USER_ADMIN_ROLES: 'userAdminRoles',  // User admin roles from the token response
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

export function getCookie(name: string): string | null {
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

const ACCESS_TOKEN_COOKIE_ALIASES = [
  COOKIE_NAMES.ACCESS_TOKEN,
  'access_token',
  'AccessToken',
  'ACCESS_TOKEN',
] as const;

const JWT_TOKEN_COOKIE_ALIASES = [
  COOKIE_NAMES.JWT_TOKEN,
  'jwt_token',
  'JwtToken',
  'JWT_TOKEN',
] as const;

function getCookieFromAliases(names: readonly string[]): string | null {
  for (const name of names) {
    const value = getCookie(name);
    if (value) return value;
  }
  return null;
}

/** Map SSO cookie names into our standard cookies (client-readable only). */
export function normalizeAuthCookiesFromBrowser(): boolean {
  const accessToken = getCookieFromAliases(ACCESS_TOKEN_COOKIE_ALIASES);
  const jwtToken = getCookieFromAliases(JWT_TOKEN_COOKIE_ALIASES);
  if (accessToken) setCookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken);
  if (jwtToken) setCookie(COOKIE_NAMES.JWT_TOKEN, jwtToken);
  return !!(accessToken && jwtToken);
}

export type ServerSessionCheck = {
  authenticated: boolean;
  hasAccessToken: boolean;
  hasJwtToken: boolean;
  user: { email?: string; tenantId?: string; userid?: string } | null;
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
    const response = await fetch('/api/auth/session', {
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
  ...ACCESS_TOKEN_COOKIE_ALIASES,
  ...JWT_TOKEN_COOKIE_ALIASES,
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

  clearActiveTenantId();
  clearAuthSessionStorage(preserveLogoutRedirect);
  clearPersistedApplicationAuthType();
}

/** Server logout API — clears HttpOnly cookies the browser JS cannot remove. */
export async function clearAuthCookiesOnServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/auth/logout', {
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

function registeredAppName(): string {
  const fromUrl = registeredAppNameOrNull();
  if (fromUrl) return fromUrl;
  const fromUser = getCurrentUser()?.tenantId?.trim();
  if (fromUser) return fromUser;
  throw new Error('No tenant configured. Open /YOUR_TENANT_ID (e.g. /ACMECOM).');
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

function parseAccessTokenFromAuthPayload(data: unknown): {
  accessToken: string;
  userUniqueID?: string;
  userAdminRoles?: string;
  userid?: string;
} {
  if (data == null || typeof data !== 'object') {
    throw new Error('Invalid OAuth callback response');
  }
  const root = data as Record<string, unknown>;
  const tokenResponse =
    root.tokenResponse && typeof root.tokenResponse === 'object'
      ? (root.tokenResponse as Record<string, unknown>)
      : null;

  const accessToken = String(
    tokenResponse?.accessToken ?? root.accessToken ?? ''
  ).trim();
  if (!accessToken) {
    throw new Error('No access token in OAuth callback response');
  }

  const userUniqueID = String(
    tokenResponse?.userUniqueID ?? root.userUniqueID ?? ''
  ).trim();
  const userAdminRoles = String(
    tokenResponse?.userAdminRoles ?? root.userAdminRoles ?? ''
  ).trim();
  const userid = String(
    tokenResponse?.userid ?? root.userid ?? userUniqueID ?? ''
  ).trim();

  return {
    accessToken,
    userUniqueID: userUniqueID || undefined,
    userAdminRoles: userAdminRoles || undefined,
    userid: userid || undefined,
  };
}

/** Exchange OAuth authorization code for an access token (Keyforge callback). */
export async function completeOAuthCallback(
  code: string,
  state: string
): Promise<{
  accessToken: string;
  userUniqueID?: string;
  userAdminRoles?: string;
  userid?: string;
}> {
  const params = new URLSearchParams({ code, state });
  const tenant = registeredAppNameOrNull();
  if (tenant) params.set('registeredAppName', tenant);
  const response = await fetch(`/api/auth/oauth/callback?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(
      `OAuth callback returned non-JSON (${response.status}): ${rawText.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'statusMessage' in data &&
      typeof (data as Record<string, unknown>).statusMessage === 'string'
        ? String((data as Record<string, unknown>).statusMessage)
        : rawText || `OAuth callback failed (${response.status})`;
    throw new Error(message);
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    ((data as Record<string, unknown>).status === 'failed' ||
      (data as Record<string, unknown>).status === 'error' ||
      (data as Record<string, unknown>).STATUS === 'FAILED')
  ) {
    throw new Error(
      String(
        (data as Record<string, unknown>).statusMessage ??
          (data as Record<string, unknown>).STATUSMESSAGE ??
          'OAuth callback failed'
      )
    );
  }

  return parseAccessTokenFromAuthPayload(data);
}

/** Persist cookies + JWT after password or OAuth login. */
export async function establishAuthenticatedSession(options: {
  accessToken: string;
  userUniqueID?: string;
  userAdminRoles?: string;
  userid?: string;
  tenantId?: string;
  /** When true and jwtToken cookie exists, skip generateJWTToken (SSO redirect already set tokens). */
  skipJwtGeneration?: boolean;
}): Promise<void> {
  const { accessToken, userUniqueID, userAdminRoles, userid, tenantId, skipJwtGeneration } =
    options;
  const resolvedUserid = userid ?? userUniqueID ?? '';
  const resolvedTenantId = tenantId?.trim() || registeredAppNameOrNull() || '';

  setCookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken);
  setCookie(
    COOKIE_NAMES.UID_TENANT,
    JSON.stringify({
      userid: resolvedUserid,
      tenantId: resolvedTenantId,
    })
  );

  if (userUniqueID) {
    setCookie(COOKIE_NAMES.REVIEWER_ID, userUniqueID);
  }
  if (userAdminRoles) {
    setCookie(COOKIE_NAMES.USER_ADMIN_ROLES, userAdminRoles);
  }

  const existingJwt = getCookie(COOKIE_NAMES.JWT_TOKEN);
  if (skipJwtGeneration && existingJwt) {
    return;
  }

  const jwtResponse = await generateJWTToken(accessToken);
  const jwtToken = extractJWTToken(jwtResponse);
  if (!jwtToken) {
    throw new Error('Failed to generate JWT token after login');
  }
  setCookie(COOKIE_NAMES.JWT_TOKEN, jwtToken);
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
  window.location.replace(target);

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
  const useProxy = typeof window !== 'undefined';
  const response = useProxy
    ? await fetch('/api/auth/application-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registeredAppName: appName }),
        cache: 'no-store',
      })
    : await fetch(`${AUTH_BASE_URL}/applicationType`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registeredAppName: appName }),
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

// API functions
export async function requestToken(
  userid: string,
  password: string,
  registeredApp?: string
): Promise<TokenResponse> {
  const appName = (registeredApp ?? registeredAppNameOrNull())?.trim();
  if (!appName) {
    throw new Error('Open the app at /YOUR_TENANT_ID (e.g. /ACMECOM or /KFPRODOCI).');
  }

  try {
    const response = await fetch(`${AUTH_BASE_URL}/requestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestToken: {
          registeredAppName: appName,
          userid: userid,
          password: password
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Check if the response indicates a failed status
    if (data.status === 'failed' || data.status === 'error' || 
        data.tokenResponse?.status === 'failed' || data.tokenResponse?.status === 'error') {
      throw new Error(`Token request returned failed status: ${data.statusMessage || 'Authentication failed'}`);
    }
    
    return data;
  } catch (error) {
    console.error('Request token error:', error);
    throw error;
  }
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

export async function requestJWTToken(accessToken: string): Promise<JWTTokenResponse> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/requestJWTToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registeredAppName: registeredAppName(),
        accessToken: accessToken
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JWT token request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Request JWT token error:', error);
    throw error;
  }
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

// Generate JWT token using the new authservice API
export async function generateJWTToken(accessToken: string): Promise<JWTTokenResponse> {
  try {
    const response = await fetch(`https://preview.keyforge.ai/authservice/api/v1/${registeredAppName()}/generateJWTToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('JWT token generation failed:', response.status, errorText);
      // Don't force logout here - let the caller (refreshJWTToken) handle it
      throw new Error(`JWT token generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Check if the response indicates a failed status
    if (data.status === 'failed' || data.status === 'error' || data.valid === false) {
      // Don't force logout here - let the caller (refreshJWTToken) handle it
      throw new Error('JWT token generation returned failed status');
    }
    
    return data;
  } catch (error) {
    console.error('Generate JWT token error:', error);
    // Don't force logout here - let the caller (refreshJWTToken) handle it
    throw error;
  }
}

// Token refresh functionality
export async function refreshJWTToken(): Promise<boolean> {
  try {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    if (!accessToken) {
      console.error('Access token not found during refresh');
      // Don't logout here - let the caller handle it
      return false;
    }

    // Generate new JWT token using the access token
    const jwtResponse = await generateJWTToken(accessToken);
    
    // Extract JWT token from response (handle different possible response formats)
    const jwtToken = extractJWTToken(jwtResponse);
    
    if (!jwtToken) {
      console.error('JWT token not found in response');
      // Don't logout here - let the caller handle it
      return false;
    }

    // Save the new JWT token to cookie
    setCookie(COOKIE_NAMES.JWT_TOKEN, jwtToken);
    console.log('JWT token refreshed successfully');
    return true;
  } catch (error) {
    console.error('JWT token refresh failed:', error);
    // Refresh failed - access token is likely expired/invalid
    // Don't logout here - let the caller handle it
    return false;
  }
}

// Enhanced API request with automatic token refresh:
// - On 401/403 or response body "Token Expired" -> try refresh JWT using access token
// - On refresh success -> retry request once
// - On refresh failure (access token expired) -> forceLogout
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

// Get reviewerId (userUniqueID) from cookies
export function getReviewerId(): string | null {
  return getCookie(COOKIE_NAMES.REVIEWER_ID);
}

// Get userAdminRoles from cookies
export function getUserAdminRoles(): string | null {
  return getCookie(COOKIE_NAMES.USER_ADMIN_ROLES);
}
