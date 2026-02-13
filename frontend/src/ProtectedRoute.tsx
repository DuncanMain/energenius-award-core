'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseJwt } from '@/utils/parseJwt';
import { authStorage } from './utils/authStorage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectIfLoggedIn?: string;
}

export default function ProtectedRoute({
  children,
  redirectIfLoggedIn = '/wallet',
}: ProtectedRouteProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  useEffect(() => {
    const checkAuth = () => {
      const token = authStorage.getToken();

      if (!token) {
        setAuthState('unauthenticated');
        return;
      }

      try {
        const payload = parseJwt(token);
        const exp = payload.exp;

        if (exp && Date.now() < exp * 1000) {
          setAuthState('authenticated');
        } else {
          authStorage.clearAuth();
          setAuthState('unauthenticated');
        }
      } catch (err) {
        authStorage.clearAuth();
        setAuthState('unauthenticated');
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (authState === 'authenticated') {
      router.replace(redirectIfLoggedIn);
    } else if (authState === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authState, router, redirectIfLoggedIn]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}