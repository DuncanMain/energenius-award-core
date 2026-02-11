'use client';
import { useState } from 'react';
import { redirect } from 'next/navigation';
import { parseJwt } from '@/utils/parseJwt';

export function useAuth() {
  const getAuthData = () => {
    const token = localStorage.getItem('jwt');
    
    if (!token) {
      redirect('/login');
      return null;
    }
    
    const payload = parseJwt(token);
    return { jwt: token, uid: payload.sub };
  };
  
  const authData = getAuthData();
  const [jwt] = useState(authData?.jwt);
  const [uid] = useState(authData?.uid);
  
  return { jwt, uid };
}