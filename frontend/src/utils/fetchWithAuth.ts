
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("jwt");

  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("jwt");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  return res;
}