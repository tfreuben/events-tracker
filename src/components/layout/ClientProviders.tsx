"use client";

import { useEffect } from "react";
import { Header } from "./Header";
import { useAuthStore } from "@/lib/store";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <>
      <Header />
      <main className="max-w-[1800px] mx-auto px-4 py-6">{children}</main>
    </>
  );
}
