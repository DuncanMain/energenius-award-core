const JWT_KEY = 'jwt';
const UID_KEY = 'uid';
const USERNAME_KEY = 'username';

export const authStorage = {
  setAuth(token: string, uid: string, username: string) {
    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(UID_KEY, uid);
    localStorage.setItem(USERNAME_KEY, username);
  },
  getUsername() {
    return localStorage.getItem(USERNAME_KEY);
  },
  getToken() {
    return localStorage.getItem(JWT_KEY);
  },

  getUid() {
    return localStorage.getItem(UID_KEY);
  },

  clearAuth() {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(UID_KEY);
  },
};
