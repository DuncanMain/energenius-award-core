'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseJwt } from '@/utils/parseJwt';
import { authStorage } from './utils/authStorage';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectIfLoggedIn?: string;
}

export default function ProtectedRoute({
  children,
  redirectIfLoggedIn = '/wallet',
}: PublicRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const payload = parseJwt(token);

      const exp = payload.exp;
      if (!exp || Date.now() < exp * 1000) {
        console.log('User is authenticated and token is valid');
        router.replace(redirectIfLoggedIn);
        return;
      } else {
        authStorage.clearAuth();
      }
    } catch (err) {
      authStorage.clearAuth();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Checking authentication...
      </div>
    );
  }

  return <>{children}</>;
}
