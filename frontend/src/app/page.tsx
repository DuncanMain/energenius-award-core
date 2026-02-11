"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { parseJwt } from "@/utils/parseJwt";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    if (token) {
      const payload = parseJwt(token);
      if (payload?.sub) {
        router.push("/wallet");
        return;
      }
    }

    router.push("/login");
  }, [router]);

  return null; // ili loader dok redirect traje

}
