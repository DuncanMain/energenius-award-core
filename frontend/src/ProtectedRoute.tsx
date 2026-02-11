'use client';

import { useEffect, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { parseJwt } from "@/utils/parseJwt";
import { authStorage } from "./utils/authStorage";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();

    if (!token) {
      router.replace("/login"); // redirect ako nije token
      return;
    }

    try {
      const payload = parseJwt(token);

      // opcionalno: provera isteka tokena
      const exp = payload.exp;
      if (exp && Date.now() >= exp * 1000) {
        authStorage.clearAuth();
        router.replace("/login");
        return;
      }

      setLoading(false); // korisnik validan
    } catch (err) {
      authStorage.clearAuth();
      router.replace("/login");
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Checking authentication...
      </div>
    );
  }

  return <>{children}</>;
}