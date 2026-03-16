"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { useAuthStore } from "@/lib/store";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const { checkSession } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/suggest") {
      checkSession();
    }
  }, [checkSession, pathname]);

  if (pathname === "/suggest") {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="max-w-[1800px] mx-auto px-4 py-6">{children}</main>
    </>
  );
}
