import { authStorage } from '@/utils/authStorage';

export function authFetch(url: string, options: RequestInit = {}) {
  const token = authStorage.getToken();

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
