import { authStorage } from "@/utils/authStorage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UseAuthOptions {
  redirectTo?: string;
}

export function useAuth(options?: UseAuthOptions) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = authStorage.getToken();
    const jwt = authStorage.getUid();

    if (!token || !jwt) {
      setIsAuthenticated(false);

      if (options?.redirectTo) {
        router.replace(options.redirectTo);
      }
    } else {
      setIsAuthenticated(true);
    }
  }, [router, options?.redirectTo]);

  const logout = () => {
    authStorage.clearAuth();
    router.replace("/login");
  };
  return {
    isAuthenticated,
    logout,
  };
}