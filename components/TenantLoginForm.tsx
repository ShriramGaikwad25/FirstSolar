'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { getCookie, COOKIE_NAMES, AUTH_SESSION_KEYS } from '@/lib/auth';

type TenantLoginFormProps = {
  tenantId: string;
};

export function TenantLoginForm({ tenantId }: TenantLoginFormProps) {
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const { login, isLoading, authType, isOAuthRedirecting, isCompletingOAuth, authError, isAuthenticated } =
    useAuth();
  const isLocalAuth = authType === 'LOCAL' || authType === null;

  useEffect(() => {
    if (
      authType &&
      authType !== 'LOCAL' &&
      sessionStorage.getItem(AUTH_SESSION_KEYS.OAUTH_CALLBACK_FAILED) === '1'
    ) {
      setError('SSO sign-in could not be completed. Please try again or contact your administrator.');
    }
  }, [authType]);

  useEffect(() => {
    const accessToken = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
    const jwtToken = getCookie(COOKIE_NAMES.JWT_TOKEN);
    if (accessToken && jwtToken && isAuthenticated) {
      window.location.replace('/');
      return;
    }
    setIsCheckingToken(false);
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const success = await login(userid, password);
      if (success) {
        window.location.href = '/';
      } else {
        setError('Invalid user ID or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    }
  };

  const showExternalAuthLoading = !isLocalAuth && (isOAuthRedirecting || isCompletingOAuth);
  if (isCheckingToken || showExternalAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isCompletingOAuth
              ? 'Completing sign in...'
              : isOAuthRedirecting
                ? 'Redirecting to sign in...'
                : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  const displayError = error || authError;

  if (authType && authType !== 'LOCAL') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          {displayError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              {displayError}
            </div>
          )}
          <p className="text-gray-600">
            {displayError
              ? 'Fix the issue above, then refresh this page to try SSO again.'
              : `Sign-in for ${tenantId} uses your organization SSO (${authType}).`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-900/20"></div>
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12"></div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
        <div className="absolute inset-0 opacity-5">
          <div className="grid-pattern"></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center">
              <Image src="/MainLogo.svg" alt="Logo" width={260} height={80} />
            </div>
          </div>

          <div className="bg-white">
      

            <form onSubmit={handleSubmit} className="space-y-6">
              {displayError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {displayError}
                </div>
              )}

              <div>
                <label htmlFor="userid" className="block text-sm font-medium text-gray-700 mb-2">
                  User ID*
                </label>
                <input
                  type="text"
                  id="userid"
                  value={userid}
                  onChange={(e) => setUserid(e.target.value)}
                  placeholder="Insert your User ID"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password*
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Insert your password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Don&apos;t have an account?{' '}
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  Register with SSO
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .grid-pattern {
          background-image:
            linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  );
}
