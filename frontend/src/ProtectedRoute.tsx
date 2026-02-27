'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseJwt } from '@/utils/parseJwt';
import { authStorage } from './utils/authStorage';
import { AuthState } from './enums/AuthState.enum';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectIfLoggedIn?: string;
}

export default function ProtectedRoute({
  children,
  redirectIfLoggedIn = '/wallet',
}: ProtectedRouteProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(AuthState.LOADING);
  const token = authStorage.getToken();

  useEffect(() => {
    const checkAuth = () => {
      if (!token) {
        setAuthState(AuthState.UNAUTHENTICATED);
        return;
      }

      try {
        const payload = parseJwt(token);
        const exp = payload.exp;

        if (exp && Date.now() < exp * 1000) {
          setAuthState(AuthState.AUTHENTICATED);
        } else {
          authStorage.clearAuth();
          setAuthState(AuthState.UNAUTHENTICATED);
        }
      } catch (err) {
        authStorage.clearAuth();
        setAuthState(AuthState.UNAUTHENTICATED);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED) {
      router.replace(redirectIfLoggedIn);
    } else if (authState === AuthState.UNAUTHENTICATED) {
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
