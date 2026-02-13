'use client';
import { useState } from 'react';
import { redirect } from 'next/navigation';
import { parseJwt } from '@/utils/parseJwt';
import { authStorage } from '@/utils/authStorage';

export function useAuth() {
  const token = authStorage.getToken();

  if (!token) {
    redirect('/login');
  }
  try {
    const payload = parseJwt(token);

    return {
      jwt: token,
      uid: payload.sub,
    };
  } catch (err) {
    redirect('/login');
  }
}
