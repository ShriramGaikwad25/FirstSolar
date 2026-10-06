'use client';

import { withBasePath } from "@/lib/basePath";
import { useAuth } from '@/contexts/AuthContext';
import { isLogoutRedirectPending } from '@/lib/auth';
import {
  getTenantLoginPath,
  hasActiveTenant,
  isLoggedOutPath,
  isTenantAuthPath,
} from '@/lib/tenant';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { useLeftSidebar } from '@/contexts/LeftSidebarContext';
import { canAccessPath, useRoleAccess } from '@/lib/roleAccess';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOAuthRedirecting, isCompletingOAuth, authType } = useAuth();
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const roleAccess = useRoleAccess();

  const pendingLoggedOut = isLogoutRedirectPending();
  const onLoggedOutPage = isLoggedOutPath(pathname ?? '');

  const isPublicAuthRoute =
    onLoggedOutPage ||
    pendingLoggedOut ||
    isTenantAuthPath(pathname ?? '') ||
    pathname?.startsWith('/oauth/callback');

  const isTenantSsoBootstrap =
    !onLoggedOutPage &&
    !pendingLoggedOut &&
    hasActiveTenant() &&
    !isAuthenticated &&
    (isOAuthRedirecting || isCompletingOAuth || (authType != null && authType !== 'LOCAL'));

  useEffect(() => {
    if (onLoggedOutPage) {
      setIsRedirecting(false);
      return;
    }

    if (pendingLoggedOut) {
      window.location.replace(withBasePath('/logged-out'));
      return;
    }

    if (!isAuthenticated && !isPublicAuthRoute && !isTenantSsoBootstrap) {
      setIsRedirecting(true);
      router.push(getTenantLoginPath());
    } else if (isAuthenticated && isTenantAuthPath(pathname ?? '')) {
      setIsRedirecting(true);
      router.push('/dashboard');
    } else {
      setIsRedirecting(false);
    }
  }, [isAuthenticated, pathname, router, isTenantSsoBootstrap, pendingLoggedOut, onLoggedOutPage, isPublicAuthRoute]);

  // Role-based page access: Help Desk Administrators only reach Dashboard, My Workspace and
  // Request Management; any other URL (typed or bookmarked) goes back to the dashboard.
  const isRoleBlocked =
    isAuthenticated && !isPublicAuthRoute && !!roleAccess && !canAccessPath(pathname ?? '', roleAccess);

  useEffect(() => {
    if (isRoleBlocked) router.replace('/dashboard');
  }, [isRoleBlocked, router]);

  if (onLoggedOutPage) {
    return <>{children}</>;
  }

  if (isRedirecting && !pendingLoggedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  if (!isPublicAuthRoute && (!roleAccess || isRoleBlocked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isAppInventoryRoute =
    typeof pathname === "string" && pathname.startsWith("/settings/app-inventory");

  const mainPadClass = isAppInventoryRoute ? "py-3 px-3" : "p-6";

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      {isSidebarVisible && <Navigation />}
      <div
        className="flex flex-1 pt-[60px] min-h-0"
        style={{
          marginLeft: isSidebarVisible ? sidebarWidthPx : 0,
        }}
      >
        <main className={`min-h-0 min-w-0 flex-1 overflow-auto bg-gray-100 ${mainPadClass}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
