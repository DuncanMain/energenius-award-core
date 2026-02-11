const JWT_KEY = "jwt";
const UID_KEY = "uid";

export const authStorage = {
  setAuth(token: string, uid: string) {
    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(UID_KEY, uid);
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