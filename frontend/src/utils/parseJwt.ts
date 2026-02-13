export function parseJwt(token: string) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token: token is required');
  }
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid token: invalid format');
  }
  try {
    return JSON.parse(atob(parts[1]));
  } catch {
    throw new Error('Invalid token: failed to decode');
  }
}
