const isBrowser = typeof window !== "undefined";

export const storage = {
  get(key: string): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(key);
  },

  set(key: string, value: string) {
    if (!isBrowser) return;
    localStorage.setItem(key, value);
  },

  remove(key: string) {
    if (!isBrowser) return;
    localStorage.removeItem(key);
  },

  clear() {
    if (!isBrowser) return;
    localStorage.clear();
  },
};