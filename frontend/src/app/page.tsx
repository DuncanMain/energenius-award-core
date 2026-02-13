'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { parseJwt } from '@/utils/parseJwt';
import { authStorage } from '@/utils/authStorage';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = authStorage.getToken();
    
    if (token) {
      try {
        const payload = parseJwt(token);
        if (payload?.sub) {
          router.push('/wallet');
          return;
        }
      } catch (err) {
        router.push('/login');
      }
    }
    router.push('/login');
  }, [router]);

  return null;
}
