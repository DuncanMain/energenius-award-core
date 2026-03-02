const JWT_KEY = 'jwt';
const UID_KEY = 'uid';
const USERNAME_KEY = 'username';
const isBrowser = typeof window !== "undefined";
export const authStorage = {
  setAuth(token: string, uid: string, username: string) {
    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(UID_KEY, uid);
    localStorage.setItem(USERNAME_KEY, username);
  },
  getUsername() {
    if (!isBrowser) return;
    return localStorage.getItem(USERNAME_KEY);
  },
  getToken() {
    if (!isBrowser) return;
    return localStorage.getItem(JWT_KEY);
  },

  getUid() {
    if (!isBrowser) return;
    return localStorage.getItem(UID_KEY);
  },

  clearAuth() {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(UID_KEY);
  },
};
